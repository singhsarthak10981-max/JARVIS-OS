import { NextResponse } from "next/server";
import { runJarvisCore, type JarvisMessage } from "@/lib/jarvis/core";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";

interface RequestBody {
  query?: unknown;
  history?: unknown;
  activeModule?: unknown;
  activeWorkspaceId?: unknown;
}

function normalizeHistory(value: unknown): JarvisMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        Boolean(message) &&
        typeof message === "object" &&
        "role" in message &&
        "content" in message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
    .map(({ role, content }) => ({ role, content: content.trim() }))
    .filter((message) => message.content.length > 0)
    .slice(-12);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "No request was provided." },
        { status: 400 },
      );
    }

    const history = normalizeHistory(body.history);
    const activeModule =
      typeof body.activeModule === "string" ? body.activeModule : undefined;
    const activeWorkspaceId =
      typeof body.activeWorkspaceId === "string"
        ? body.activeWorkspaceId
        : undefined;

    const result = await runJarvisCore(
      { query, history, activeModule, activeWorkspaceId },
      OLLAMA_URL,
      OLLAMA_MODEL,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach the local J.A.R.V.I.S. AI service.";

    return NextResponse.json(
      { error: `J.A.R.V.I.S. AI unavailable. ${message}` },
      { status: 503 },
    );
  }
}
