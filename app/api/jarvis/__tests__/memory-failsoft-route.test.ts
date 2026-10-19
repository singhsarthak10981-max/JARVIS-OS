import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST } from "../route";

/**
 * Fail-soft contract: with `JARVIS_DATA_DIR` pointing at a regular file,
 * the memory database can never be created. Chat must degrade to
 * no-memory — a normal streamed reply — instead of failing the request.
 * Kept in its own file so the (per-file) database singleton binds to the
 * broken path from the first call.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jarvis-memory-down-"));
  const notADirectory = path.join(root, "not-a-directory");
  writeFileSync(notADirectory, "x");
  process.env.JARVIS_DATA_DIR = notADirectory;
});

afterAll(() => {
  delete process.env.JARVIS_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function sse(text: string): Response {
  const frame = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return new Response(`data: ${frame}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("chat with the memory database unavailable", () => {
  it("streams a normal reply and completes the turn", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sse("Still here, Sarthak."))
    );

    const response = await POST(
      new Request("http://localhost:3000/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "ollama",
          model: "qwen2.5:7b",
          webSearch: false,
          memories: [],
          ownerName: "Sarthak",
          messages: [{ role: "user", content: "Are you there?" }],
        }),
      })
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    const frames = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(frames.some((f) => f.type === "done")).toBe(true);
    expect(
      frames
        .filter((f) => f.type === "delta")
        .map((f) => String(f.text))
        .join("")
    ).toContain("Still here");
  });
});
