import { deleteAllMemory, deleteProjectMemory, readSemanticMemory } from "@/db/memory";
import { readYouTubeSession } from "../youtube/oauth";
import { resolveMemoryOwner } from "./identity";

function projectIdFrom(request: Request) {
  const value = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  return /^[a-zA-Z0-9_-]{8,80}$/.test(value) ? value : "";
}

export async function GET(request: Request) {
  const projectId = projectIdFrom(request);
  if (!projectId) return Response.json({ error: "A valid projectId is required." }, { status: 400 });
  try {
    const session = await readYouTubeSession();
    const ownerId = await resolveMemoryOwner(request.url, session);
    return Response.json({ memory: await readSemanticMemory(ownerId, projectId) });
  } catch (error) {
    console.error("Semantic memory could not be read:", error);
    return Response.json({ error: "Semantic memory is temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const projectId = projectIdFrom(request);
  if (scope !== "all" && !projectId) return Response.json({ error: "A valid projectId is required." }, { status: 400 });
  try {
    const session = await readYouTubeSession();
    const ownerId = await resolveMemoryOwner(request.url, session);
    if (scope === "all") await deleteAllMemory(ownerId);
    else await deleteProjectMemory(ownerId, projectId);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Semantic memory could not be deleted:", error);
    return Response.json({ error: "Semantic memory is temporarily unavailable." }, { status: 503 });
  }
}
