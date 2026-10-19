/**
 * Safe link parsing for assistant messages.
 *
 * The renderer never injects HTML. This module only classifies text into
 * plain segments and http(s) links; every URL is validated here and again at
 * render time, so `javascript:`, `data:` and other schemes can never become
 * an `href`.
 */

export type MessageSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const MAX_URL_CHARS = 2_048;
const MAX_LABEL_CHARS = 300;

/** Absolute http(s) URL, no credentials, no whitespace/control characters. */
export function isSafeHttpUrl(value: string): boolean {
  if (!value || value.length > MAX_URL_CHARS) return false;
  if (/[\u0000-\u0020\u007f]/.test(value)) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (!parsed.hostname || !parsed.hostname.includes(".")) return false;
  if (parsed.username || parsed.password) return false;
  return true;
}

/** Normalised href for a safe URL, or null. */
export function safeHref(value: string): string | null {
  const trimmed = value.trim();
  if (!isSafeHttpUrl(trimmed)) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

/**
 * Splits a single line of text into plain and link segments.
 * Recognises `[label](https://…)` and bare `https://…` URLs.
 */
export function parseMessageSegments(input: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer) {
      segments.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  let index = 0;
  while (index < input.length) {
    if (input[index] === "[") {
      const markdown = readMarkdownLink(input, index);
      if (markdown) {
        flush();
        segments.push({
          type: "link",
          text: markdown.label,
          href: markdown.href,
        });
        index = markdown.end;
        continue;
      }
    }

    if (isBareUrlStart(input, index)) {
      const bare = readBareUrl(input, index);
      if (bare) {
        flush();
        segments.push({ type: "link", text: bare.label, href: bare.href });
        index = bare.end;
        continue;
      }
    }

    buffer += input[index];
    index += 1;
  }

  flush();
  return segments;
}

function readMarkdownLink(
  input: string,
  start: number
): { label: string; href: string; end: number } | null {
  const labelEnd = input.indexOf("]", start + 1);
  if (labelEnd === -1) return null;

  const label = input.slice(start + 1, labelEnd);
  if (!label || label.length > MAX_LABEL_CHARS) return null;
  if (label.includes("[") || label.includes("\n")) return null;
  if (input[labelEnd + 1] !== "(") return null;

  // Balanced parentheses inside the target, e.g. Wikipedia URLs.
  let depth = 0;
  let cursor = labelEnd + 2;
  const limit = Math.min(input.length, labelEnd + 2 + MAX_URL_CHARS + 2);
  while (cursor < limit) {
    const char = input[cursor];
    if (char === "\n" || char === "]" || char === "[") return null;
    if (char === "(") depth += 1;
    if (char === ")") {
      if (depth === 0) {
        const href = safeHref(input.slice(labelEnd + 2, cursor));
        if (!href) return null;
        return { label, href, end: cursor + 1 };
      }
      depth -= 1;
    }
    cursor += 1;
  }

  return null;
}

function isBareUrlStart(input: string, index: number): boolean {
  if (index > 0) {
    const previous = input[index - 1];
    // Only start at a boundary, so `xhttps://…` is not treated as a link.
    if (!/[\s([{«"'*]/.test(previous)) return false;
  }
  return /^https?:\/\//i.test(input.slice(index, index + 8));
}

function readBareUrl(
  input: string,
  start: number
): { label: string; href: string; end: number } | null {
  let cursor = start;
  const limit = Math.min(input.length, start + MAX_URL_CHARS);
  while (cursor < limit) {
    const char = input[cursor];
    if (/[\s<>"'`*]/.test(char)) break;
    cursor += 1;
  }

  let raw = input.slice(start, cursor);
  // Trailing sentence punctuation and unbalanced brackets are not part of it.
  for (;;) {
    const last = raw[raw.length - 1];
    if (!last) break;
    if (/[.,;:!?]/.test(last)) {
      raw = raw.slice(0, -1);
      continue;
    }
    if (last === ")" && count(raw, ")") > count(raw, "(")) {
      raw = raw.slice(0, -1);
      continue;
    }
    if (last === "]" && count(raw, "]") > count(raw, "[")) {
      raw = raw.slice(0, -1);
      continue;
    }
    break;
  }

  const href = safeHref(raw);
  if (!href) return null;
  return { label: raw, href, end: start + raw.length };
}

function count(value: string, char: string): number {
  let total = 0;
  for (const item of value) if (item === char) total += 1;
  return total;
}
