import {
  cleanMemorySummary,
  emptySemanticMemory,
  mergeMemoryFacts,
} from "@/app/api/generate-titles/semantic-memory.mjs";

export type MemoryFact = { key: string; value: string; category: string };
export type SemanticMemory = {
  creator: { summary: string; facts: MemoryFact[] };
  project: { summary: string; facts: MemoryFact[] };
};

export type SemanticMemoryUpdate = {
  creatorSummary?: string;
  creatorFacts?: unknown[];
  removeCreatorKeys?: unknown[];
  projectSummary?: string;
  projectFacts?: unknown[];
  removeProjectKeys?: unknown[];
};

export type DebugConversationTurn = {
  request: unknown;
  response: unknown;
  createdAt: string;
};

type MemoryRow = { summary: string; facts_json: string; updated_at?: string };
type ProjectMemoryRow = MemoryRow & { project_id: string };
type DebugConversationRow = { project_id: string; turns_json: string; created_at?: string; updated_at?: string };

let schemaPromise: Promise<void> | null = null;

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensureMemorySchema() {
  if (!schemaPromise) {
    schemaPromise = database().then((db) => db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS creator_memories (
        owner_id TEXT PRIMARY KEY NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        facts_json TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS project_memories (
        owner_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        facts_json TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (owner_id, project_id)
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS debug_conversations (
        owner_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        turns_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (owner_id, project_id)
      )`),
    ])).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function parseFacts(value: string | undefined, scope: "creator" | "project") {
  try {
    return mergeMemoryFacts([], JSON.parse(value || "[]"), [], scope, scope === "creator" ? 24 : 32) as MemoryFact[];
  } catch {
    return [];
  }
}

function mergeRows(
  source: MemoryRow,
  target: MemoryRow | null,
  scope: "creator" | "project",
) {
  if (!target) {
    return {
      summary: cleanMemorySummary(source.summary),
      facts: parseFacts(source.facts_json, scope),
    };
  }
  const sourceIsNewer = String(source.updated_at || "") >= String(target.updated_at || "");
  const older = sourceIsNewer ? target : source;
  const newer = sourceIsNewer ? source : target;
  return {
    summary: cleanMemorySummary(newer.summary) || cleanMemorySummary(older.summary),
    facts: mergeMemoryFacts(
      parseFacts(older.facts_json, scope),
      parseFacts(newer.facts_json, scope),
      [],
      scope,
      scope === "creator" ? 24 : 32,
    ) as MemoryFact[],
  };
}

export async function mergeMemoryOwners(sourceOwnerId: string, targetOwnerId: string) {
  if (!sourceOwnerId || !targetOwnerId || sourceOwnerId === targetOwnerId) return;
  await ensureMemorySchema();
  const db = await database();
  const [sourceCreator, targetCreator, sourceProjects, sourceDebugConversations] = await Promise.all([
    db.prepare("SELECT summary, facts_json, updated_at FROM creator_memories WHERE owner_id = ?").bind(sourceOwnerId).first<MemoryRow>(),
    db.prepare("SELECT summary, facts_json, updated_at FROM creator_memories WHERE owner_id = ?").bind(targetOwnerId).first<MemoryRow>(),
    db.prepare("SELECT project_id, summary, facts_json, updated_at FROM project_memories WHERE owner_id = ?").bind(sourceOwnerId).all<ProjectMemoryRow>(),
    db.prepare("SELECT project_id, turns_json, created_at, updated_at FROM debug_conversations WHERE owner_id = ?").bind(sourceOwnerId).all<DebugConversationRow>(),
  ]);
  const statements: ReturnType<typeof db.prepare>[] = [];

  if (sourceCreator) {
    const merged = mergeRows(sourceCreator, targetCreator, "creator");
    statements.push(db.prepare(`INSERT INTO creator_memories (owner_id, summary, facts_json, version, updated_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id) DO UPDATE SET summary = excluded.summary, facts_json = excluded.facts_json,
      version = creator_memories.version + 1, updated_at = CURRENT_TIMESTAMP`)
      .bind(targetOwnerId, merged.summary, JSON.stringify(merged.facts)));
  }

  for (const sourceProject of sourceProjects.results || []) {
    const targetProject = await db.prepare("SELECT summary, facts_json, updated_at FROM project_memories WHERE owner_id = ? AND project_id = ?")
      .bind(targetOwnerId, sourceProject.project_id).first<MemoryRow>();
    const merged = mergeRows(sourceProject, targetProject, "project");
    statements.push(db.prepare(`INSERT INTO project_memories (owner_id, project_id, summary, facts_json, version, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id, project_id) DO UPDATE SET summary = excluded.summary, facts_json = excluded.facts_json,
      version = project_memories.version + 1, updated_at = CURRENT_TIMESTAMP`)
      .bind(targetOwnerId, sourceProject.project_id, merged.summary, JSON.stringify(merged.facts)));
  }

  for (const sourceConversation of sourceDebugConversations.results || []) {
    const targetConversation = await db.prepare("SELECT turns_json FROM debug_conversations WHERE owner_id = ? AND project_id = ?")
      .bind(targetOwnerId, sourceConversation.project_id).first<{ turns_json: string }>();
    const mergedTurns = [
      ...parseDebugTurns(targetConversation?.turns_json),
      ...parseDebugTurns(sourceConversation.turns_json),
    ].slice(-24);
    statements.push(db.prepare(`INSERT INTO debug_conversations (owner_id, project_id, turns_json, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id, project_id) DO UPDATE SET turns_json = excluded.turns_json, updated_at = CURRENT_TIMESTAMP`)
      .bind(targetOwnerId, sourceConversation.project_id, JSON.stringify(mergedTurns)));
  }

  statements.push(
    db.prepare("DELETE FROM debug_conversations WHERE owner_id = ?").bind(sourceOwnerId),
    db.prepare("DELETE FROM project_memories WHERE owner_id = ?").bind(sourceOwnerId),
    db.prepare("DELETE FROM creator_memories WHERE owner_id = ?").bind(sourceOwnerId),
  );
  await db.batch(statements);
}

export async function readSemanticMemory(ownerId: string, projectId: string): Promise<SemanticMemory> {
  await ensureMemorySchema();
  const db = await database();
  const [creator, project] = await Promise.all([
    db.prepare("SELECT summary, facts_json FROM creator_memories WHERE owner_id = ?").bind(ownerId).first<MemoryRow>(),
    db.prepare("SELECT summary, facts_json FROM project_memories WHERE owner_id = ? AND project_id = ?").bind(ownerId, projectId).first<MemoryRow>(),
  ]);
  const memory = emptySemanticMemory() as SemanticMemory;
  if (creator) memory.creator = { summary: cleanMemorySummary(creator.summary), facts: parseFacts(creator.facts_json, "creator") };
  if (project) memory.project = { summary: cleanMemorySummary(project.summary), facts: parseFacts(project.facts_json, "project") };
  return memory;
}

function parseDebugTurns(value: string | undefined): DebugConversationTurn[] {
  try {
    const turns = JSON.parse(value || "[]");
    if (!Array.isArray(turns)) return [];
    return turns.filter((turn) => turn && typeof turn === "object").slice(-24) as DebugConversationTurn[];
  } catch {
    return [];
  }
}

export async function readDebugConversation(ownerId: string, projectId: string) {
  await ensureMemorySchema();
  const db = await database();
  const row = await db.prepare("SELECT turns_json, created_at, updated_at FROM debug_conversations WHERE owner_id = ? AND project_id = ?")
    .bind(ownerId, projectId)
    .first<{ turns_json: string; created_at: string; updated_at: string }>();
  if (!row) return null;
  return {
    projectId,
    turns: parseDebugTurns(row.turns_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function recordDebugConversationTurn(ownerId: string, projectId: string, turn: DebugConversationTurn) {
  if (!ownerId || !projectId) return;
  await ensureMemorySchema();
  const db = await database();
  const existing = await db.prepare("SELECT turns_json FROM debug_conversations WHERE owner_id = ? AND project_id = ?")
    .bind(ownerId, projectId)
    .first<{ turns_json: string }>();
  const turns = [...parseDebugTurns(existing?.turns_json), turn].slice(-24);
  await db.batch([
    db.prepare(`INSERT INTO debug_conversations (owner_id, project_id, turns_json, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id, project_id) DO UPDATE SET turns_json = excluded.turns_json, updated_at = CURRENT_TIMESTAMP`)
      .bind(ownerId, projectId, JSON.stringify(turns)),
    db.prepare("DELETE FROM debug_conversations WHERE updated_at < datetime('now', '-14 days')"),
  ]);
}

export async function updateSemanticMemory(ownerId: string, projectId: string, update: SemanticMemoryUpdate): Promise<SemanticMemory> {
  const current = await readSemanticMemory(ownerId, projectId);
  const db = await database();
  const creatorFacts = mergeMemoryFacts(current.creator.facts, update.creatorFacts, update.removeCreatorKeys, "creator", 24) as MemoryFact[];
  const projectFacts = mergeMemoryFacts(current.project.facts, update.projectFacts, update.removeProjectKeys, "project", 32) as MemoryFact[];
  const creatorSummary = cleanMemorySummary(update.creatorSummary) || current.creator.summary;
  const projectSummary = cleanMemorySummary(update.projectSummary) || current.project.summary;

  await db.batch([
    db.prepare(`INSERT INTO creator_memories (owner_id, summary, facts_json, version, updated_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id) DO UPDATE SET summary = excluded.summary, facts_json = excluded.facts_json,
      version = creator_memories.version + 1, updated_at = CURRENT_TIMESTAMP`)
      .bind(ownerId, creatorSummary, JSON.stringify(creatorFacts)),
    db.prepare(`INSERT INTO project_memories (owner_id, project_id, summary, facts_json, version, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id, project_id) DO UPDATE SET summary = excluded.summary, facts_json = excluded.facts_json,
      version = project_memories.version + 1, updated_at = CURRENT_TIMESTAMP`)
      .bind(ownerId, projectId, projectSummary, JSON.stringify(projectFacts)),
  ]);

  return {
    creator: { summary: creatorSummary, facts: creatorFacts },
    project: { summary: projectSummary, facts: projectFacts },
  };
}

export async function deleteProjectMemory(ownerId: string, projectId: string) {
  await ensureMemorySchema();
  const db = await database();
  await db.batch([
    db.prepare("DELETE FROM project_memories WHERE owner_id = ? AND project_id = ?").bind(ownerId, projectId),
    db.prepare("DELETE FROM debug_conversations WHERE owner_id = ? AND project_id = ?").bind(ownerId, projectId),
  ]);
}

export async function deleteAllMemory(ownerId: string) {
  await ensureMemorySchema();
  const db = await database();
  await db.batch([
    db.prepare("DELETE FROM project_memories WHERE owner_id = ?").bind(ownerId),
    db.prepare("DELETE FROM creator_memories WHERE owner_id = ?").bind(ownerId),
    db.prepare("DELETE FROM debug_conversations WHERE owner_id = ?").bind(ownerId),
  ]);
}
