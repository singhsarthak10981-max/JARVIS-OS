import { NextResponse } from "next/server";
import { listFacts, listSkills } from "@/lib/memory/db";
import { findSecret } from "@/lib/memory/guard";
import { memoryEnabled } from "@/lib/memory/chat";
import {
  MAX_RECALL_ENTRIES,
  type RecallFact,
  type RecallResponse,
  type RecallSkill,
} from "@/lib/memory/recall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only recall feed for explicit conversational recall.
 *
 *   GET /api/memory/recall
 *
 * This is deliberately separate from `GET /api/memory` (the review/overview
 * endpoint): recall returns only what the assistant needs to show — fact
 * key/value pairs and skill names/descriptions, newest/most-used first, at
 * most MAX_RECALL_ENTRIES of each. Skill steps are never returned, and the
 * free-form `source` column is not transmitted: only the allowlisted
 * `inferred` flag survives, because `source` accepts arbitrary strings at
 * write time and is not covered by the secret guard.
 *
 * The browser composes the reply locally from this payload; nothing here is
 * sent to a model. Two rules are enforced server-side:
 *
 *  - `JARVIS_MEMORY=off` returns `{ enabled: false }` with empty arrays and no
 *    record contents at all. The existing management routes are unaffected,
 *    so records stay reviewable and deletable.
 *  - Rows that trip the secret guard are withheld (counted, never sent).
 *
 * Reads are audited by the existing data layer (counts only, no contents).
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

function disabledPayload(limit: number): RecallResponse {
  return {
    enabled: false,
    limit,
    facts: [],
    skills: [],
    totalFacts: 0,
    totalSkills: 0,
    withheld: { facts: 0, skills: 0 },
  };
}

export async function GET() {
  if (!memoryEnabled()) {
    return NextResponse.json(disabledPayload(MAX_RECALL_ENTRIES), {
      headers: NO_STORE,
    });
  }

  try {
    const factPage = listFacts({ limit: MAX_RECALL_ENTRIES });
    const skillPage = listSkills({ limit: MAX_RECALL_ENTRIES });

    const facts: RecallFact[] = [];
    const skills: RecallSkill[] = [];
    const withheld = { facts: 0, skills: 0 };

    for (const fact of factPage.facts) {
      // Write-time filtering should already have refused these; a row that
      // fails today's rules is withheld rather than transmitted.
      if (findSecret([fact.key, fact.value]) !== null) {
        withheld.facts += 1;
        continue;
      }
      const entry: RecallFact = { key: fact.key, value: fact.value };
      // Allowlisted indicator only — never the raw `source` string.
      if (fact.source.trim().toLowerCase() === "inferred") {
        entry.inferred = true;
      }
      facts.push(entry);
    }

    for (const skill of skillPage.skills) {
      if (findSecret([skill.name, skill.description]) !== null) {
        withheld.skills += 1;
        continue;
      }
      // Name and description only; steps stay out of this payload entirely.
      skills.push({ name: skill.name, description: skill.description });
    }

    const payload: RecallResponse = {
      enabled: true,
      limit: MAX_RECALL_ENTRIES,
      facts,
      skills,
      totalFacts: factPage.total,
      totalSkills: skillPage.total,
      withheld,
    };
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch {
    // Fail-soft: the client treats a failed request as a partial recall.
    // Deliberately log a generic line only: a database exception can carry
    // record contents (values, snippets, paths) in its message, and this
    // endpoint must never put memory contents into logs.
    console.error("[jarvis-memory] recall endpoint failed");
    return NextResponse.json(
      { error: "Memory recall failed." },
      { status: 500, headers: NO_STORE }
    );
  }
}
