import { describe, expect, it } from "vitest";
import { MAX_OUTGOING_HISTORY, buildOutgoingHistory } from "../history";
import type { ChatMessage } from "../types";

/**
 * The outgoing model history is the first egress boundary for explicit
 * recall: a local-only answer may contain SQLite-derived facts, so it must
 * never be part of the payload sent to `/api/jarvis` — for any provider.
 * These tests inspect the exact objects that would be serialized.
 */

function message(
  id: string,
  role: ChatMessage["role"],
  text: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage {
  return { id, role, text, timestamp: 1, ...extra };
}

describe("buildOutgoingHistory", () => {
  it("keeps ordinary user and assistant turns exactly as before", () => {
    const history = buildOutgoingHistory([
      message("s1", "system", "system note"),
      message("u1", "user", "hello"),
      message("a1", "assistant", "hi there"),
      message("u2", "user", "open the DJ module", { action: true }),
      message("a2", "assistant", "Opened DJ module.", { action: true }),
      message("a3", "assistant", "failed", { error: true }),
      message("u3", "user", "   "),
    ]);
    expect(history).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ]);
  });

  it("excludes a local-only recall answer from the payload", () => {
    const history = buildOutgoingHistory([
      message("u1", "user", "what do you remember?"),
      message(
        "a1",
        "assistant",
        "**Saved facts**\n- coffee_preference: oat flat white",
        { localOnly: true }
      ),
    ]);
    expect(history).toEqual([
      { role: "user", content: "what do you remember?" },
    ]);
    expect(JSON.stringify(history)).not.toContain("oat flat white");
    expect(JSON.stringify(history)).not.toContain("Saved facts");
  });

  it("cannot leak a previous recall answer on a later ordinary turn", () => {
    // The realistic sequence: recall turn, then a normal question. The
    // recall answer sits between two ordinary messages and stays out.
    const history = buildOutgoingHistory([
      message("u1", "user", "what do you remember?"),
      message("a1", "assistant", "- home_city: Murcia", { localOnly: true }),
      message("u2", "user", "explain React hooks"),
    ]);
    expect(history).toEqual([
      { role: "user", content: "what do you remember?" },
      { role: "user", content: "explain React hooks" },
    ]);
    expect(JSON.stringify(history)).not.toContain("Murcia");
  });

  it("keeps the existing 14-message window", () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      message(`m${i}`, i % 2 === 0 ? "user" : "assistant", `message ${i}`)
    );
    const history = buildOutgoingHistory(messages);
    expect(MAX_OUTGOING_HISTORY).toBe(14);
    expect(history).toHaveLength(14);
    expect(history[0].content).toBe("message 6");
  });

  it("excludes any truthy local-only marker, and keeps an explicit false", () => {
    // The type is boolean, so in practice this is `true`. Treating any
    // truthy value as local-only is the conservative direction.
    const history = buildOutgoingHistory([
      message("u1", "user", "keep me", { localOnly: false }),
      message("a1", "assistant", "drop me", {
        localOnly: "yes" as unknown as boolean,
      }),
      message("u2", "user", "keep me too"),
    ]);
    expect(history).toEqual([
      { role: "user", content: "keep me" },
      { role: "user", content: "keep me too" },
    ]);
  });
});
