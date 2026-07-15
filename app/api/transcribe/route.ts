const MODEL = "gemini-3.1-flash-lite";
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

function cleanBase64(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return "";
  return value;
}

export async function POST(request: Request) {
  let body: { data?: unknown; mimeType?: unknown };
  try {
    body = await request.json() as { data?: unknown; mimeType?: unknown };
  } catch {
    return Response.json({ error: "The recording could not be read." }, { status: 400 });
  }

  const mimeType = typeof body.mimeType === "string" ? body.mimeType.split(";")[0].toLowerCase() : "";
  const data = cleanBase64(body.data);
  if (!AUDIO_TYPES.has(mimeType) || !data) {
    return Response.json({ error: "That recording format is not supported." }, { status: 400 });
  }
  if (Math.ceil(data.length * 0.75) > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Keep voice messages under 90 seconds." }, { status: 413 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Voice transcription is not configured yet." }, { status: 503 });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Transcribe the creator's recording faithfully. Return only the words they spoke, with light punctuation. Do not answer the recording or add commentary." }] },
        contents: [{ role: "user", parts: [
          { inlineData: { mimeType, data } },
          { text: "Transcribe this voice message." },
        ] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: { transcript: { type: "string" } },
            required: ["transcript"],
            additionalProperties: false,
          },
          maxOutputTokens: 800,
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      }),
    });
    const result = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(result.error?.message || `Gemini ${response.status}`);
    const output = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    const transcript = String((JSON.parse(output) as { transcript?: unknown }).transcript || "").trim().slice(0, 1600);
    if (!transcript) throw new Error("The recording was empty");
    return Response.json({ transcript });
  } catch (error) {
    console.error("Voice transcription failed:", error);
    return Response.json({ error: "I could not hear that clearly. Try recording again." }, { status: 502 });
  }
}
