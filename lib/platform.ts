/**
 * Platform-aware labels for keyboard hints.
 *
 * Shortcuts are stored once, in the macOS notation used by the module
 * registry ("⌘+1", "⌘⇧J"). Rendering that verbatim on Windows told users to
 * press a key their keyboard does not have, so every visible hint goes
 * through `formatShortcut`.
 */

export type Platform = "mac" | "other";

/** Shorten a stored shortcut to the keys, without the separators. */
function keyToken(token: string): string {
  switch (token) {
    case "⌘":
    case "Cmd":
    case "CmdOrCtrl":
      return "Ctrl";
    case "⇧":
    case "Shift":
      return "Shift";
    case "⌥":
    case "Alt":
      return "Alt";
    case "⌃":
    case "Ctrl":
      return "Ctrl";
    case "⌫":
      return "Backspace";
    case "↩":
      return "Enter";
    // Punctuation is named, not drawn. A bare "," at hint sizes is two pixels
    // tall and reads as a full stop ("Ctrl ," looked like "Ctrl ."). Naming
    // the key matches how Backspace and Enter are already presented.
    case ",":
      return "Comma";
    case ".":
      return "Period";
    case "/":
      return "Slash";
    case ";":
      return "Semicolon";
    case "'":
      return "Quote";
    case "-":
      return "Minus";
    case "=":
      return "Equals";
    case "[":
      return "Left Bracket";
    case "]":
      return "Right Bracket";
    case "`":
      return "Backtick";
    default:
      return token;
  }
}

function splitShortcut(shortcut: string): string[] {
  // Stored shortcuts use two notations: "⌘+1" (separated) and "⌘⇧J"
  // (symbols concatenated). Splitting on separators alone treats the latter
  // as one unknown token, so each modifier symbol is first spaced out.
  return shortcut
    .replace(/([⌘⇧⌥⌃⌫↩])/g, " $1 ")
    .split(/[+\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * "⌘+1" → "Ctrl 1" on Windows/Linux, "⌘1" on macOS.
 * "⌘⇧J" → "Ctrl Shift J" or "⌘⇧J".
 */
export function formatShortcut(shortcut: string, platform: Platform): string {
  const tokens = splitShortcut(shortcut);
  if (tokens.length === 0) return "";

  if (platform === "mac") {
    return tokens
      .map((token) => (token === "CmdOrCtrl" ? "⌘" : token))
      .join("");
  }

  return tokens.map(keyToken).join(" ");
}

/** A plain, readable sentence for tooltips: "Press Ctrl Shift J". */
export function shortcutLabel(shortcut: string, platform: Platform): string {
  const formatted = formatShortcut(shortcut, platform);
  return formatted ? `Press ${formatted}` : "";
}

/**
 * Detect the platform once, in the browser. During server rendering there is
 * no navigator, so callers that render statically should pass "other" and
 * let the client correct itself after hydration.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const described =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ??
    navigator.platform ??
    "";
  const agent = navigator.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(described) || /Mac OS X/i.test(agent)
    ? "mac"
    : "other";
}
