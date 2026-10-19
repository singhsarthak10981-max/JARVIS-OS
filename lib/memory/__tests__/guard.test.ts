import { describe, expect, it } from "vitest";
import { findSecret } from "../guard";

/**
 * The secret values below are public test fixtures (Stripe's test card,
 * documentation example keys) — safe to keep in the repo. They exist to
 * prove the shapes are caught, and that everyday facts are not.
 */

describe("findSecret rejects", () => {
  it("flags card numbers, spaced or bare", () => {
    expect(findSecret(["card is 4242 4242 4242 4242"])).toBe("card number");
    expect(findSecret(["4242424242424242"])).toBe("card number");
    expect(findSecret(["3782-822463-10005"])).toBe("card number"); // Amex test
  });

  it("flags well-known API key shapes", () => {
    expect(findSecret(["sk-proj-9f8e7d6c5b4a39281706f5e4d3c2b1a0"])).toBe("API key");
    expect(findSecret(["ghp_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p"])).toBe("API key");
    expect(findSecret(["AKIAIOSFODNN7EXAMPLE"])).toBe("API key");
    expect(findSecret(["tvly-dev-1a2b3c4d5e6f7g8h9i0j"])).toBe("API key");
  });

  it("flags JWTs, bearer tokens and private keys", () => {
    expect(
      findSecret([
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N",
      ])
    ).toBe("auth token");
    expect(findSecret(["Authorization: Bearer abcdef0123456789"])).toBe(
      "auth token"
    );
    expect(findSecret(["-----BEGIN RSA PRIVATE KEY-----"])).toBe("private key");
  });

  it("flags password assignments and declarations", () => {
    expect(findSecret(["wifi password: correct-horse-battery"])).toBe("password");
    expect(findSecret(["api_key=9f8e7d6c5b4a3928"])).toBe("password");
    expect(findSecret(["the garage pin is 4417"])).toBe("password");
    expect(findSecret(["password is hunter2, obviously"])).toBe("password");
  });

  it("scans every text it is given", () => {
    expect(findSecret(["harmless name", "fine step", "use sk-proj-9f8e7d6c5b4a39281706"])).toBe(
      "API key"
    );
  });
});

describe("findSecret allows", () => {
  it("accepts everyday facts that merely mention secrets", () => {
    expect(findSecret(["password_manager", "Bitwarden"])).toBeNull();
    expect(findSecret(["prefers token-based auth in side projects"])).toBeNull();
    expect(findSecret(["remind me to rotate the API key in June"])).toBeNull();
  });

  it("accepts numbers that are not cards", () => {
    // 16 digits, but fails Luhn — an order number, not a card.
    expect(findSecret(["order 1234-5678-9012-3456 shipped Tuesday"])).toBeNull();
    expect(findSecret(["phone +34 612 345 678"])).toBeNull();
    expect(findSecret(["Ollama runs on port 11434"])).toBeNull();
  });

  it("accepts hashes and ids (no entropy guessing)", () => {
    expect(findSecret(["7828f41c2b6d9e0a1f2c3d4e5f60718293a4b5c6d"])).toBeNull();
    expect(findSecret(["deploy task-1234 before the weekend"])).toBeNull();
  });
});
