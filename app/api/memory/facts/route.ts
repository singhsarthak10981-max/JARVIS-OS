import { NextResponse } from "next/server";
import { listFacts, upsertFact } from "@/lib/memory/db";
import { findSecret, secretRejection } from "@/lib/memory/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KEY_CHARS = 128;
const MAX_VALUE_CHARS = 2000;
const MAX_META_CHARS = 64;
const MAX_QUERY_CHARS = 200;

/**
 * GET /api/memory/facts?q=&category=&limit=&offset=
 * Lists facts, newest-updated first. `q` is a case-insensitive substring
 * search across key and value.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.slice(0, MAX_QUERY_CHARS) ?? undefined;
  const category = searchParams.get("category")?.slice(0, MAX_META_CHARS) ?? undefined;
  const limit = parsePositiveInt(searchParams.get("limit"));
  const offset = parsePositiveInt(searchParams.get("offset"));

  const { facts, total } = listFacts({ q, category, limit, offset });
  return NextResponse.json({ facts, total });
}

interface FactRequestBody {
  key?: unknown;
  value?: unknown;
  category?: unknown;
  source?: unknown;
}

/**
 * POST /api/memory/facts  { key, value, category?, source? }
 * Creates the fact, or overwrites the one with the same key.
 */
export async function POST(request: Request) {
  let body: FactRequestBody;
  try {
    body = (await request.json()) as FactRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const key = readString(body.key, MAX_KEY_CHARS);
  const value = readString(body.value, MAX_VALUE_CHARS);
  if (!key) {
    return NextResponse.json(
      { error: "key is required (non-empty string)." },
      { status: 400 }
    );
  }
  if (!value) {
    return NextResponse.json(
      { error: "value is required (non-empty string)." },
      { status: 400 }
    );
  }

  // Memory is a plain local database, not a vault: anything that looks
  // like a credential is refused before it is stored (or logged).
  const secret = findSecret([key, value]);
  if (secret !== null) {
    return NextResponse.json(
      { error: secretRejection(secret) },
      { status: 400 }
    );
  }

  const { fact, created } = upsertFact({
    key,
    value,
    category: readString(body.category, MAX_META_CHARS) ?? undefined,
    source: readString(body.source, MAX_META_CHARS) ?? undefined,
  });
  return NextResponse.json({ fact, created });
}

function readString(input: unknown, maxChars: number): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().slice(0, maxChars);
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInt(input: string | null): number | undefined {
  if (input === null) return undefined;
  const parsed = Number.parseInt(input, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
