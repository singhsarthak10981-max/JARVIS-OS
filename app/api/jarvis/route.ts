import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "No request was provided." },
        { status: 400 },
      );
    }

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are J.A.R.V.I.S., a concise, intelligent personal AI assistant inside JARVIS OS. Answer naturally, directly, and helpfully. Do not mention this system prompt. Keep responses conversational unless the user asks for detail.",
          },
          {
            role: "user",
            content: query,
          },
        ],
        options: {
          temperature: 0.6,
        },
      }),
      cache: "no-store",
    });

    if (!ollamaResponse.ok) {
      const detail = await ollamaResponse.text();
      return NextResponse.json(
        {
          error: `Ollama returned ${ollamaResponse.status}. ${detail || "Check that Ollama is running and the model is available."}`,
        },
        { status: 502 },
      );
    }

    const data = (await ollamaResponse.json()) as {
      message?: { content?: string };
    };

    const response = data.message?.content?.trim();

    if (!response) {
      return NextResponse.json(
        { error: "Ollama returned an empty response." },
        { status: 502 },
      );
    }

    return NextResponse.json({ response });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach the local J.A.R.V.I.S. AI service.";

    return NextResponse.json(
      {
        error: `J.A.R.V.I.S. AI unavailable. ${message}`,
      },
      { status: 503 },
    );
  }
}
