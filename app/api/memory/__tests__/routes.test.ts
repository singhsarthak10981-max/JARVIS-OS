import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DELETE } from "../route";
import { GET as getFacts, POST as postFact } from "../facts/route";
import { GET as getSkills, POST as postSkill } from "../skills/route";
import { getDb } from "@/lib/memory/db";

/**
 * Route-level tests for the memory API. Storage is redirected to one
 * temporary directory for the whole file (getDb() caches its handle per
 * process); tests reset state through the wipe endpoint itself. Nothing
 * touches the checkout's `.jarvis-data/` or the network.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jarvis-memory-route-"));
  process.env.JARVIS_DATA_DIR = root;
});

afterAll(() => {
  getDb().close();
  delete process.env.JARVIS_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
});

beforeEach(async () => {
  const res = await DELETE(
    new Request("http://localhost:3000/api/memory?scope=all&confirm=true", {
      method: "DELETE",
    })
  );
  expect(res.status).toBe(200);
});

function post(pathname: string, body: unknown): Request {
  return new Request(`http://localhost:3000${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("secret rejection", () => {
  it("refuses a fact whose value is a card number, and stores nothing", async () => {
    const res = await postFact(
      post("/api/memory/facts", { key: "card", value: "4242 4242 4242 4242" })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("card number");
    expect(body.error).not.toContain("4242");

    const list = await getFacts(
      new Request("http://localhost:3000/api/memory/facts")
    );
    expect(((await list.json()) as { total: number }).total).toBe(0);
  });

  it("refuses a fact that declares a password", async () => {
    const res = await postFact(
      post("/api/memory/facts", {
        key: "wifi",
        value: "the wifi password is correct-horse",
      })
    );
    expect(res.status).toBe(400);
  });

  it("refuses an API key hiding in a skill step", async () => {
    const res = await postSkill(
      post("/api/memory/skills", {
        name: "call-api",
        steps: ["Set the header", "Use sk-proj-9f8e7d6c5b4a39281706f5e4d3c2"],
      })
    );
    expect(res.status).toBe(400);

    const list = await getSkills(
      new Request("http://localhost:3000/api/memory/skills")
    );
    expect(((await list.json()) as { total: number }).total).toBe(0);
  });

  it("still accepts ordinary facts and skills", async () => {
    const fact = await postFact(
      post("/api/memory/facts", { key: "password_manager", value: "Bitwarden" })
    );
    expect(fact.status).toBe(200);

    const skill = await postSkill(
      post("/api/memory/skills", {
        name: "brew",
        steps: ["Boil water", "Steep 4 minutes"],
      })
    );
    expect(skill.status).toBe(200);
  });
});

describe("wipe confirmation", () => {
  it("requires confirm=true for every scope, including facts", async () => {
    await postFact(post("/api/memory/facts", { key: "city", value: "Madrid" }));

    const refused = await DELETE(
      new Request("http://localhost:3000/api/memory?scope=facts", {
        method: "DELETE",
      })
    );
    expect(refused.status).toBe(400);

    const stillThere = await getFacts(
      new Request("http://localhost:3000/api/memory/facts")
    );
    expect(((await stillThere.json()) as { total: number }).total).toBe(1);

    const confirmed = await DELETE(
      new Request("http://localhost:3000/api/memory?scope=facts&confirm=true", {
        method: "DELETE",
      })
    );
    expect(confirmed.status).toBe(200);

    const gone = await getFacts(
      new Request("http://localhost:3000/api/memory/facts")
    );
    expect(((await gone.json()) as { total: number }).total).toBe(0);
  });

  it("requires confirm=true for scope=all too", async () => {
    const res = await DELETE(
      new Request("http://localhost:3000/api/memory?scope=all", {
        method: "DELETE",
      })
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain(
      "confirm=true"
    );
  });
});
