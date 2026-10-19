import { NextResponse } from "next/server";
import {
  deleteConversation,
  listConversations,
  listFacts,
  listMemoryLog,
  listSkills,
  memoryOverview,
  wipeMemory,
  type WipeScope,
} from "@/lib/memory/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Review endpoint: everything Jarvis has stored, in one response.
 *
 *   GET /api/memory
 *   GET /api/memory?include=facts,log&limit=25
 *
 * `include` is a comma-separated subset of: facts, skills, conversations,
 * log (default: all). `limit` applies per section (default 100, max 500).
 * Counts are always returned, even for excluded sections. This is the
 * endpoint a future Settings → Memory panel should read from.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const include = new Set(
    (searchParams.get("include") ?? "facts,skills,conversations,log")
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0)
  );
  const limitRaw = searchParams.get("limit");
  const limitParsed = limitRaw === null ? NaN : Number.parseInt(limitRaw, 10);
  const limit =
    Number.isInteger(limitParsed) && limitParsed > 0 ? limitParsed : 100;

  const review: Record<string, unknown> = { counts: memoryOverview() };
  if (include.has("facts")) {
    review.facts = listFacts({ limit }).facts;
  }
  if (include.has("skills")) {
    review.skills = listSkills({ limit }).skills;
  }
  if (include.has("conversations")) {
    review.conversations = listConversations({ limit });
  }
  if (include.has("log")) {
    review.log = listMemoryLog({ limit });
  }
  return NextResponse.json(review);
}

const WIPE_SCOPES: readonly WipeScope[] = [
  "facts",
  "skills",
  "conversations",
  "log",
  "all",
];

/**
 * Delete endpoint: remove one conversation, or wipe a whole category.
 *
 *   DELETE /api/memory?conversation=3
 *   DELETE /api/memory?scope=facts|skills|conversations|log
 *   DELETE /api/memory?scope=all&confirm=true
 *
 * `scope=all` additionally needs `confirm=true` so a stray (or
 * model-hallucinated) call cannot nuke the entire memory in one request.
 * Single facts/skills are deleted via /api/memory/facts/:id and
 * /api/memory/skills/:id. Responds with the number of rows removed.
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);

  const conversationRaw = searchParams.get("conversation");
  if (conversationRaw !== null) {
    if (!/^\d+$/.test(conversationRaw)) {
      return NextResponse.json(
        { error: "conversation must be a positive integer id." },
        { status: 400 }
      );
    }
    const id = Number.parseInt(conversationRaw, 10);
    if (!deleteConversation(id)) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ deleted: true, conversation: id });
  }

  const scope = searchParams.get("scope") as WipeScope | null;
  if (scope === null || !WIPE_SCOPES.includes(scope)) {
    return NextResponse.json(
      {
        error:
          "Provide ?scope=facts|skills|conversations|log|all or ?conversation=<id>.",
      },
      { status: 400 }
    );
  }
  if (scope === "all" && searchParams.get("confirm") !== "true") {
    return NextResponse.json(
      { error: "Wiping all memory requires ?scope=all&confirm=true." },
      { status: 400 }
    );
  }

  const deleted = wipeMemory(scope);
  return NextResponse.json({ scope, deleted });
}
