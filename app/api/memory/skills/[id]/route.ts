import { NextResponse } from "next/server";
import { deleteSkill, getSkill, recordSkillUse } from "@/lib/memory/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/memory/skills/:id — one skill by id. */
export async function GET(_request: Request, { params }: RouteParams) {
  const id = await parseId(params);
  if (id === null) return invalidId();

  const skill = getSkill(id);
  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }
  return NextResponse.json({ skill });
}

/**
 * POST /api/memory/skills/:id — record one use of the skill.
 * Increments `times_used` and stamps `last_used`. No body required.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const id = await parseId(params);
  if (id === null) return invalidId();

  const skill = recordSkillUse(id);
  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }
  return NextResponse.json({ skill });
}

/** DELETE /api/memory/skills/:id — permanently removes the skill. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await parseId(params);
  if (id === null) return invalidId();

  if (!deleteSkill(id)) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }
  return NextResponse.json({ deleted: true, id });
}

async function parseId(params: RouteParams["params"]): Promise<number | null> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return null;
  const parsed = Number.parseInt(id, 10);
  return parsed > 0 ? parsed : null;
}

function invalidId() {
  return NextResponse.json(
    { error: "id must be a positive integer." },
    { status: 400 }
  );
}
