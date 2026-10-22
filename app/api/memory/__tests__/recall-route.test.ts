import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET as getRecall } from "../recall/route";
import { GET as getOverview } from "../route";
import {
  deleteFact,
  getDb,
  listFacts,
  listMemoryLog,
  upsertFact,
  upsertSkill,
  wipeMemory,
} from "@/lib/memory/db";
import {
  buildRecallReply,
  parseRecallResponse,
  type RecallResponse,
} from "@/lib/memory/recall";

/**
 * The read-only recall feed. Storage is one temporary directory for the
 * whole file (`getDb()` caches its handle per process); nothing touches the
 * checkout's `.jarvis-data/` or the network.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jarvis-memory-recall-"));
  process.env.JARVIS_DATA_DIR = root;
});

afterAll(() => {
  getDb().close();
  delete process.env.JARVIS_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env.JARVIS_MEMORY;
  wipeMemory("all", getDb());
});

afterEach(() => {
  delete process.env.JARVIS_MEMORY;
  vi.restoreAllMocks();
});


async function recall(): Promise<RecallResponse> {
  const response = await getRecall();
  expect(response.status).toBe(200);
  return (await response.json()) as RecallResponse;
}

describe("GET /api/memory/recall", () => {
  it("returns saved facts and learned skills (name and description only)", async () => {
    upsertFact(
      { key: "coffee_preference", value: "oat flat white", category: "preferences" },
      getDb()
    );
    upsertSkill(
      {
        name: "brew-coffee",
        description: "V60 pour-over",
        steps: ["Boil water to 93C", "Bloom 45s", "Pour to 300g"],
      },
      getDb()
    );

    const response = await getRecall();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as RecallResponse;

    expect(body.enabled).toBe(true);
    expect(body.facts).toEqual([
      { key: "coffee_preference", value: "oat flat white" },
    ]);
    expect(body.skills).toEqual([
      { name: "brew-coffee", description: "V60 pour-over" },
    ]);
    expect(body.totalFacts).toBe(1);
    expect(body.totalSkills).toBe(1);
    expect(body.withheld).toEqual({ facts: 0, skills: 0 });

    // Steps exist in SQLite but are not part of the recall payload.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Boil water");
    expect(serialized).not.toContain("Bloom");
    expect(serialized).not.toContain("steps");
  });

  it("caps facts and skills at 25 each and reports the totals", async () => {
    for (let i = 1; i <= 30; i++) {
      upsertFact({ key: `fact_${i}`, value: `value ${i}` }, getDb());
    }
    for (let i = 1; i <= 30; i++) {
      upsertSkill(
        { name: `skill-${i}`, description: `does ${i}`, steps: [`step ${i}`] },
        getDb()
      );
    }

    const body = await recall();
    expect(body.limit).toBe(25);
    expect(body.facts).toHaveLength(25);
    expect(body.skills).toHaveLength(25);
    expect(body.totalFacts).toBe(30);
    expect(body.totalSkills).toBe(30);
  });

  it("never transmits the raw source column, even when it looks like a secret", async () => {
    // F2 regression: `source` accepts arbitrary strings at write time and is
    // not covered by the write-time guard, so the recall endpoint must not
    // echo it. Only the allowlisted `inferred` indicator may cross the wire.
    upsertFact(
      {
        key: "home_city",
        value: "Murcia",
        source: "sk-proj-9f8e7d6c5b4a39281706f5e4d3c2",
      },
      getDb()
    );
    upsertFact(
      { key: "tea_preference", value: "green tea", source: "inferred" },
      getDb()
    );

    const response = await getRecall();
    expect(response.status).toBe(200);
    const body = (await response.json()) as RecallResponse;

    expect(body.facts).toHaveLength(2);
    expect(body.facts).toContainEqual({ key: "home_city", value: "Murcia" });
    expect(body.facts).toContainEqual({
      key: "tea_preference",
      value: "green tea",
      inferred: true,
    });
    // No arbitrary source string, no `source` field at all.
    expect(body.facts.some((fact) => "source" in fact)).toBe(false);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("sk-proj");
    expect(serialized).not.toContain("9f8e7d6c5b4a39281706f5e4d3c2");

    // Rendered recall: the secret is absent and only [inferred] survives.
    const recall = buildRecallReply({ pinboard: [], server: body });
    expect(recall.text).not.toContain("sk-proj");
    expect(recall.text).not.toContain("9f8e7d6c5b4a39281706f5e4d3c2");
    expect(recall.text).toContain("- tea_preference: green tea [inferred]");
    expect(recall.text).toContain("- home_city: Murcia");
  });

  it("withholds secret-shaped rows that predate today's guard rules", async () => {
    // Written straight through the data layer, bypassing the route's
    // write-time refusal, to model a row stored by an older build.
    upsertFact(
      { key: "leaked_key", value: "sk-proj-9f8e7d6c5b4a39281706f5e4d3c2" },
      getDb()
    );
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, getDb());

    const body = await recall();
    expect(body.facts).toEqual([
      { key: "coffee_preference", value: "oat flat white" },
    ]);
    expect(body.withheld.facts).toBe(1);
    expect(body.totalFacts).toBe(2);
    expect(JSON.stringify(body)).not.toContain("9f8e7d6c5b4a39281706f5e4d3c2");
  });

  it("returns disabled status and zero record contents when JARVIS_MEMORY=off", async () => {
    upsertFact({ key: "home_city", value: "Murcia" }, getDb());
    upsertSkill(
      { name: "brew-coffee", description: "V60 pour-over", steps: ["Bloom 45s"] },
      getDb()
    );

    process.env.JARVIS_MEMORY = "off";
    const response = await getRecall();
    expect(response.status).toBe(200);
    // The disabled answer must not be cached either.
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as RecallResponse;

    expect(body).toEqual({
      enabled: false,
      limit: 25,
      facts: [],
      skills: [],
      totalFacts: 0,
      totalSkills: 0,
      withheld: { facts: 0, skills: 0 },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Murcia");
    expect(serialized).not.toContain("V60");
    expect(serialized).not.toContain("Bloom");
  });

  it("leaves the management/overview endpoint fully available while killed", async () => {
    upsertFact({ key: "home_city", value: "Murcia" }, getDb());
    process.env.JARVIS_MEMORY = "off";

    const overviewResponse = await getOverview(
      new Request("http://localhost:3000/api/memory?include=facts,skills")
    );
    expect(overviewResponse.status).toBe(200);
    const overview = (await overviewResponse.json()) as {
      counts: { facts: number; skills: number };
      facts: { key: string; value: string }[];
      skills: unknown[];
    };
    expect(overview.counts.facts).toBe(1);
    expect(overview.facts).toEqual([
      expect.objectContaining({ key: "home_city", value: "Murcia" }),
    ]);

    // ...and deletion still works, so the kill switch never traps data.
    const [fact] = listFacts({}, getDb()).facts;
    expect(deleteFact(fact.id, getDb())).toBe(true);
    expect(listFacts({}, getDb()).total).toBe(0);
  });

  it("audits recall reads without logging record contents", async () => {
    upsertFact({ key: "home_city", value: "Murcia" }, getDb());
    upsertSkill(
      { name: "brew-coffee", description: "V60 pour-over", steps: ["Bloom 45s"] },
      getDb()
    );

    await recall();

    // The write entries above legitimately name the keys (pre-existing audit
    // behaviour). What matters here is what the recall reads logged.
    const recallReads = listMemoryLog({ limit: 50 }, getDb()).filter(
      (entry) => entry.action === "read"
    );
    expect(recallReads).toHaveLength(2);
    const serialized = JSON.stringify(recallReads);
    expect(serialized).not.toContain("Murcia");
    expect(serialized).not.toContain("home_city");
    expect(serialized).not.toContain("V60");
    expect(serialized).not.toContain("Bloom");
    // Counts only, never contents.
    expect(recallReads.every((entry) => /^list \(\d+ total\)$/.test(entry.detail))).toBe(
      true
    );
  });

  it("fails closed on a database error without exposing record contents", async () => {
    // A sentinel that can only appear if the caught exception itself is
    // logged or returned. It models a driver error whose message embeds a
    // stored value — the exact thing this endpoint must never leak.
    const SENTINEL = "SENTINEL_DB_LEAK_7f3c9a21";
    upsertFact({ key: "home_city", value: "Murcia" }, getDb());
    upsertSkill(
      { name: "brew-coffee", description: "V60 pour-over", steps: ["Bloom 45s"] },
      getDb()
    );

    // Simulate a read failure inside the data layer. The route must answer
    // 500 with a generic message and log nothing derived from the rows or
    // from the exception object.
    const logged: string[] = [];
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        logged.push(
          args
            .map((arg) => {
              if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}\n${arg.stack ?? ""}`;
              }
              return String(arg);
            })
            .join(" ")
        );
      });
    const db = getDb();
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, "prepare").mockImplementation(((sql: string) => {
      if (/FROM facts/i.test(sql)) {
        throw new Error(`disk I/O error near "${SENTINEL}"`);
      }
      return originalPrepare(sql);
    }) as typeof db.prepare);

    const response = await getRecall();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Memory recall failed." });

    // The sentinel — which is reachable only through the exception message —
    // must appear in neither the HTTP response nor any console output.
    const serializedResponse = JSON.stringify(body);
    expect(serializedResponse).not.toContain(SENTINEL);
    const serializedLog = logged.join("\n");
    expect(serializedLog).not.toContain(SENTINEL);

    // Nothing from the store leaks into the response or the log line.
    expect(serializedResponse).not.toContain("Murcia");
    expect(serializedResponse).not.toContain("home_city");
    expect(serializedResponse).not.toContain("V60");
    expect(serializedLog).not.toContain("Murcia");
    expect(serializedLog).not.toContain("home_city");
    expect(serializedLog).not.toContain("V60");
    expect(serializedLog).not.toContain("Bloom");
    // A generic failure line is still emitted for diagnosability.
    expect(serializedLog).toContain("recall endpoint failed");
    expect(serializedLog).not.toContain("disk I/O error");

    consoleError.mockRestore();
  });

  it("reports a partial recall when the endpoint body is malformed", async () => {
    // Defence in depth at the client boundary: a structurally incomplete
    // `enabled: true` payload is rejected rather than shown as an empty bank.
    const parsed = parseRecallResponse({ enabled: true, facts: [] });
    expect(parsed).toBeNull();

    const recall = buildRecallReply({ pinboard: ["my studio is in Madrid"], server: parsed });
    expect(recall.status).toBe("partial");
    expect(recall.text).toContain("Recall was partial");
    expect(recall.text).not.toContain("(nothing stored)");
  });

  it("is unaffected by a normal (enabled) environment after a killed turn", async () => {
    upsertFact({ key: "home_city", value: "Murcia" }, getDb());
    process.env.JARVIS_MEMORY = "off";
    expect((await recall()).enabled).toBe(false);

    delete process.env.JARVIS_MEMORY;
    const body = await recall();
    expect(body.enabled).toBe(true);
    expect(body.facts[0]).toMatchObject({ key: "home_city", value: "Murcia" });
  });
});
