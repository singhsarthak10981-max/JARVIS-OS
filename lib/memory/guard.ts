/**
 * Secret detector for memory writes.
 *
 * Memory is a plain local SQLite file meant for facts and procedures, so
 * anything that *looks like* a credential is refused at the API boundary
 * instead of being stored: card numbers (Luhn-checked, so order numbers
 * and phone numbers pass), well-known API-key/token shapes, private-key
 * headers, and `password: …` / `api_key=…` style assignments.
 *
 * This is a heuristic guardrail, not a vault. It deliberately skips generic
 * high-entropy matching: a 40-char hex string is as likely to be a git SHA
 * as a secret, and rejecting those would make memory unusable. Real secrets
 * belong in a password manager; this keeps them out of Jarvis's notes.
 */

export type SecretKind =
  | "card number"
  | "API key"
  | "auth token"
  | "private key"
  | "password";

const TOKEN_PATTERNS: readonly { kind: SecretKind; pattern: RegExp }[] = [
  { kind: "private key", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  // OpenAI / Anthropic (sk-, sk-proj-, sk-ant-)
  { kind: "API key", pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/ },
  // GitHub personal access tokens, classic and fine-grained
  { kind: "API key", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/ },
  { kind: "API key", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  // AWS access key id
  { kind: "API key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  // Google API key
  { kind: "API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  // Slack tokens
  { kind: "API key", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  // Tavily — the search provider this app uses
  { kind: "API key", pattern: /\btvly-[A-Za-z0-9-]{16,}/ },
  // JWTs are three base64url segments; the header almost always starts eyJ
  {
    kind: "auth token",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  { kind: "auth token", pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}/i },
];

// `password: hunter2`, `api_key=abc123`, `client_secret: …`
const SECRET_ASSIGNMENT =
  /\b(?:password|passwd|passcode|pwd|api[_-]?key|apikey|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*\S+/i;

// `the wifi password is correct-horse`, `pin is 1234`
const SECRET_DECLARATION = /\b(?:password|passcode|pin)\s+is\s+["'`]?[^\s"',.]{4,}/i;

// 13–19 digits with single space/dash separators, not part of a longer run.
const CARD_CANDIDATE = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let doubled = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48; // '0' === 48
    if (doubled) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubled = !doubled;
  }
  return sum % 10 === 0;
}

function findCardNumber(text: string): boolean {
  for (const match of text.matchAll(CARD_CANDIDATE)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) {
      return true;
    }
  }
  return false;
}

/**
 * Scan texts for anything that looks like a secret. Returns what it looked
 * like, or null when everything is clean. Never returns the secret itself.
 */
export function findSecret(texts: readonly string[]): SecretKind | null {
  for (const text of texts) {
    if (findCardNumber(text)) return "card number";
    for (const { kind, pattern } of TOKEN_PATTERNS) {
      if (pattern.test(text)) return kind;
    }
    if (SECRET_ASSIGNMENT.test(text) || SECRET_DECLARATION.test(text)) {
      return "password";
    }
  }
  return null;
}

/** User-facing explanation for a rejection, shared by all write routes. */
export function secretRejection(kind: SecretKind): string {
  const article = kind === "API key" || kind === "auth token" ? "an" : "a";
  return `Refused: that looks like ${article} ${kind}. Jarvis does not store secrets in memory — keep it in your password manager, and store only a note about where it lives.`;
}
