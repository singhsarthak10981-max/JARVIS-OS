import { NextResponse } from "next/server";
import { deleteFact, getFact } from "@/lib/memory/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/memory/facts/:id — one fact by id. */
export async function GET(_request: Request, { params }: RouteParams) {
  const id = await parseId(params);
  if (id === null) return invalidId();

  const fact = getFact(id);
  if (!fact) {
    return NextResponse.json({ error: "Fact not found." }, { status: 404 });
  }
  return NextResponse.json({ fact });
}

/** DELETE /api/memory/facts/:id — permanently removes the fact. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const id = await parseId(params);
  if (id === null) return invalidId();

  if (!deleteFact(id)) {
    return NextResponse.json({ error: "Fact not found." }, { status: 404 });
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
