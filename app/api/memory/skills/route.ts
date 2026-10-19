import { NextResponse } from "next/server";
import { listSkills, upsertSkill } from "@/lib/memory/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_CHARS = 128;
const MAX_DESCRIPTION_CHARS = 1000;
const MAX_STEPS = 50;
const MAX_STEP_CHARS = 500;
const MAX_QUERY_CHARS = 200;

/**
 * GET /api/memory/skills?q=&limit=
 * Lists skills, most-used first. `q` is a case-insensitive substring
 * search across name and description.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.slice(0, MAX_QUERY_CHARS) ?? undefined;
  const limitRaw = searchParams.get("limit");
  const limitParsed = limitRaw === null ? NaN : Number.parseInt(limitRaw, 10);
  const limit = Number.isInteger(limitParsed) && limitParsed > 0 ? limitParsed : undefined;

  const { skills, total } = listSkills({ q, limit });
  return NextResponse.json({ skills, total });
}

interface SkillRequestBody {
  name?: unknown;
  description?: unknown;
  steps?: unknown;
}

/**
 * POST /api/memory/skills  { name, description?, steps: string[] }
 * Teaches Jarvis a procedure, or replaces the steps of the skill with the
 * same name (usage counters are kept).
 */
export async function POST(request: Request) {
  let body: SkillRequestBody;
  try {
    body = (await request.json()) as SkillRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = readString(body.name, MAX_NAME_CHARS);
  if (!name) {
    return NextResponse.json(
      { error: "name is required (non-empty string)." },
      { status: 400 }
    );
  }

  const steps = readSteps(body.steps);
  if (steps === null) {
    return NextResponse.json(
      { error: "steps must be an array of non-empty strings." },
      { status: 400 }
    );
  }
  if (steps.length === 0) {
    return NextResponse.json(
      { error: "steps must contain at least one step." },
      { status: 400 }
    );
  }

  const { skill, created } = upsertSkill({
    name,
    description: readString(body.description, MAX_DESCRIPTION_CHARS) ?? "",
    steps,
  });
  return NextResponse.json({ skill, created });
}

function readString(input: unknown, maxChars: number): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().slice(0, maxChars);
  return trimmed.length > 0 ? trimmed : null;
}

function readSteps(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const steps: string[] = [];
  for (const item of input.slice(0, MAX_STEPS)) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim().slice(0, MAX_STEP_CHARS);
    if (trimmed.length > 0) steps.push(trimmed);
  }
  return steps;
}
