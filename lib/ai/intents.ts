import { MODULES, type ModuleId } from "@/lib/modules";
import { THEMES, WALLPAPER_PRESETS, type ThemeId } from "./providers";
import { evaluateMath, formatNumber, looksLikeMath } from "./math";
import { getLibrarySnapshot } from "@/services/library/libraryIndex";
import { toCamelot } from "@/services/library/camelot";
import { loadSetlists } from "@/features/dj/setlistStore";

/**
 * JARVIS intent router.
 *
 * Every message is first run through this deterministic, local router. When a
 * message maps to a desktop action JARVIS executes it instantly — no model
 * round-trip, no API key. Anything conversational is handed to the configured
 * language model (or the local language core).
 */

export type JarvisAction =
  | { type: "open-module"; moduleId: ModuleId }
  | { type: "close-module"; moduleId: ModuleId }
  | { type: "close-all-windows" }
  | { type: "set-theme"; theme: ThemeId | "next" }
  | { type: "set-wallpaper"; preset: string }
  | {
      type: "toggle-setting";
      setting: "scanlines" | "particles" | "soundEnabled" | "voiceEnabled";
      value?: boolean;
    }
  | { type: "start-timer"; seconds: number; label: string }
  | { type: "cancel-timers" }
  | { type: "remember"; fact: string }
  | { type: "forget-memory" }
  | { type: "reboot" }
  | { type: "clear-session" }
  | { type: "open-palette" }
  | { type: "export-logs" }
  | { type: "stop-speaking" };

export interface IntentContext {
  ownerName: string;
  activeModule: ModuleId;
  openWindows: number;
  providerLabel: string;
  providerIsLocal: boolean;
  memoryCount: number;
  memories: string[];
  currentTheme: string;
  wakePhrase?: string;
  now?: Date;
}

export interface IntentResolution {
  kind: "action" | "answer" | "chat";
  action?: JarvisAction;
  reply?: string;
  /** Short status line shown in the panel while the action executes. */
  thought?: string;
}

export const WAKE_WORD = "jarvis";

const MODULE_ALIASES: Record<ModuleId, string[]> = {
  "command-center": [
    "command center",
    "command centre",
    "dashboard",
    "mission control",
    "home",
  ],
  dj: ["dj", "decks", "turntables", "music deck"],
  producer: ["producer", "production", "studio", "fl studio", "beat lab"],
  bar: ["bar", "bar manager", "inventory"],
  business: ["business", "finance", "revenue", "contracts"],
  settings: ["settings", "preferences", "configuration", "config", "system settings"],
};

const THEME_ALIASES: Record<string, ThemeId> = {
  "tactical red": "tactical-red",
  "tactical": "tactical-red",
  "red": "tactical-red",
  "crimson": "tactical-red",
  "arc reactor": "arc-reactor",
  "arc": "arc-reactor",
  "cyan": "arc-reactor",
  "blue": "arc-reactor",
  "stealth": "stealth",
  "amber": "stealth",
  "yellow": "stealth",
};

const WALLPAPER_ALIASES: Record<string, string> = {
  "tactical red": "tactical-red",
  tactical: "tactical-red",
  "midnight blue": "midnight-blue",
  midnight: "midnight-blue",
  blue: "midnight-blue",
  emerald: "emerald",
  green: "emerald",
  "royal purple": "royal-purple",
  purple: "royal-purple",
  carbon: "carbon",
  grey: "carbon",
  gray: "carbon",
  animated: "animated-gradient",
  gradient: "animated-gradient",
  plasma: "animated-gradient",
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  fortyfive2: 45,
  sixty: 60,
  ninety: 90,
};

function pick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripWakeWord(normalized: string, customPhrase?: string): string {
  const phrases = [customPhrase?.trim().toLowerCase(), WAKE_WORD].filter(
    (phrase): phrase is string => Boolean(phrase)
  );

  let result = normalized;
  for (const phrase of phrases) {
    result = result
      .replace(
        new RegExp(`^(hey|ok|okay|yo)?\\s*${escapeRegExp(phrase)}[,:!.\\s]+`),
        ""
      )
      .trim();
  }
  return result;
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text);
}

function matchModule(text: string): ModuleId | null {
  let best: { id: ModuleId; length: number } | null = null;
  for (const mod of MODULES) {
    for (const alias of MODULE_ALIASES[mod.id]) {
      if (hasWord(text, alias.replace(/ /g, "\\s+"))) {
        if (!best || alias.length > best.length) {
          best = { id: mod.id, length: alias.length };
        }
      }
    }
  }
  return best?.id ?? null;
}

function matchTheme(text: string): ThemeId | null {
  for (const [alias, id] of Object.entries(THEME_ALIASES)) {
    if (hasWord(text, alias)) return id;
  }
  return null;
}

function matchWallpaper(text: string): string | null {
  for (const [alias, id] of Object.entries(WALLPAPER_ALIASES)) {
    if (hasWord(text, alias)) return id;
  }
  return null;
}

function moduleLabel(id: ModuleId): string {
  return MODULES.find((m) => m.id === id)?.label ?? id;
}

function formatTime(now: Date): string {
  return now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(now: Date): string {
  return now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function parseNumber(token: string): number | null {
  const cleaned = token.replace(/-/g, "");
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  return NUMBER_WORDS[cleaned] ?? null;
}

/** Parses "1 hour 30 minutes", "90 seconds", "5 min", "for 2 hours". */
export function parseDuration(text: string): number | null {
  const unitPattern =
    /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|forty-five|sixty|ninety)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g;

  let total = 0;
  let matched = false;
  let match: RegExpExecArray | null;

  while ((match = unitPattern.exec(text)) !== null) {
    const value = parseNumber(match[1]);
    if (value === null) continue;
    const unit = match[2];
    matched = true;
    if (unit.startsWith("h")) total += value * 3600;
    else if (unit.startsWith("m")) total += value * 60;
    else total += value;
  }

  if (!matched || total <= 0) return null;
  return Math.min(total, 24 * 3600);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (secs && !hours) parts.push(`${secs} second${secs === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 seconds";
}

export const JARVIS_CAPABILITIES = [
  "Open, close and switch modules — “open the DJ module”",
  "Change theme and wallpaper — “switch to stealth theme”",
  "Report system status, time and date",
  "Set timers and reminders — “set a timer for 10 minutes”",
  "Remember facts — “remember that the studio lights are on channel 4”",
  "Search your Traktor library — “find tracks at 128 BPM in 8A”",
  "Report library and setlist status — “how many tracks do I have?”",
  "Toggle voice, scanlines, particles and sound",
  "Reboot, clear the session or export the activity log",
  "Answer open-ended questions when a language model is connected",
];

export const SUGGESTED_PROMPTS = [
  "System status report",
  "How many tracks are in my DJ library?",
  "Open the Producer module",
  "Switch to arc reactor theme",
  "Set a timer for 5 minutes",
  "What can you do?",
];

export function resolveIntent(
  rawInput: string,
  ctx: IntentContext
): IntentResolution {
  const now = ctx.now ?? new Date();
  const raw = rawInput.trim();
  const t = stripWakeWord(normalize(raw), ctx.wakePhrase);
  const owner = ctx.ownerName || "sir";

  if (!t) return { kind: "chat" };

  // ── Memory ────────────────────────────────────────────────
  const rememberMatch = t.match(
    /^(?:please\s+)?(?:remember|note|keep in mind)(?:\s+that)?\s+(.{3,300})$/
  );
  if (rememberMatch) {
    const fact = rememberMatch[1].replace(/[.!]$/, "").trim();
    return {
      kind: "action",
      action: { type: "remember", fact },
      thought: "Committing to memory bank",
      reply: pick([
        `Noted, ${owner}. I'll remember that.`,
        `Stored. I won't lose it.`,
        `Memory updated, ${owner}.`,
      ]),
    };
  }

  if (
    /^(forget (everything|all)|clear (your |the )?memory|wipe (your |the )?memory|forget everything you know)/.test(
      t
    )
  ) {
    return {
      kind: "action",
      action: { type: "forget-memory" },
      thought: "Purging memory bank",
      reply: "Memory bank wiped. A clean slate.",
    };
  }

  if (
    /(what do you remember|what do you know about me|recall|memory bank|show (your )?memory)/.test(
      t
    )
  ) {
    if (ctx.memoryCount === 0) {
      return {
        kind: "answer",
        reply:
          "My long-term memory is empty. Say “remember that…” and I'll keep it for you.",
      };
    }
    const facts = ctx.memories.slice(0, 8).map((m, i) => `${i + 1}. ${m}`);
    return {
      kind: "answer",
      reply: `I'm holding ${ctx.memoryCount} memor${ctx.memoryCount === 1 ? "y" : "ies"}:\n${facts.join("\n")}`,
    };
  }

  // ── Timers ────────────────────────────────────────────────
  if (/(cancel|stop|clear|kill).*(timer|timers|reminder|reminders)/.test(t)) {
    return {
      kind: "action",
      action: { type: "cancel-timers" },
      thought: "Cancelling timers",
      reply: "All timers cancelled.",
    };
  }

  const timerIntent =
    /\b(timer|remind me|reminder)\b/.test(t) &&
    (parseDuration(t) !== null || /timer/.test(t));

  if (timerIntent) {
    const seconds = parseDuration(t);
    if (seconds === null) {
      return {
        kind: "answer",
        reply:
          "Give me a duration for the timer — for example “set a timer for 10 minutes”.",
      };
    }
    const labelMatch = t.match(/(?:to|that|about)\s+(.{3,80})$/);
    const label = labelMatch
      ? labelMatch[1].replace(/[.!]$/, "")
      : `${formatDuration(seconds)} timer`;
    return {
      kind: "action",
      action: { type: "start-timer", seconds, label },
      thought: `Arming timer for ${formatDuration(seconds)}`,
      reply: `Timer armed for ${formatDuration(seconds)}. I'll notify you, ${owner}.`,
    };
  }

  // ── Theme / wallpaper ─────────────────────────────────────
  if (/\b(theme|themes)\b/.test(t)) {
    if (/(next|cycle|rotate|another|different)/.test(t)) {
      return {
        kind: "action",
        action: { type: "set-theme", theme: "next" },
        thought: "Re-rendering interface theme",
        reply: "Cycling to the next theme.",
      };
    }
    // allow "change theme to stealth"
    const theme = matchTheme(t) ?? matchTheme(t.replace(/.*theme\s+(?:to\s+)?/, ""));
    if (theme) {
      const label = THEMES.find((x) => x.id === theme)?.label ?? theme;
      return {
        kind: "action",
        action: { type: "set-theme", theme },
        thought: `Loading ${label} palette`,
        reply: pick([
          `Switching to the ${label} palette.`,
          `${label} theme engaged.`,
        ]),
      };
    }
    if (/(change|switch|toggle)/.test(t)) {
      return {
        kind: "action",
        action: { type: "set-theme", theme: "next" },
        thought: "Re-rendering interface theme",
        reply: "Cycling to the next theme.",
      };
    }
  }

  if (/(switch|change|set|use|activate|load).*(arc reactor|stealth|tactical red)/.test(t)) {
    const theme = matchTheme(t);
    if (theme) {
      const label = THEMES.find((x) => x.id === theme)?.label ?? theme;
      return {
        kind: "action",
        action: { type: "set-theme", theme },
        thought: `Loading ${label} palette`,
        reply: `Switching to the ${label} palette.`,
      };
    }
  }

  if (/\b(wallpaper|background)\b/.test(t)) {
    const preset = matchWallpaper(t);
    if (preset) {
      return {
        kind: "action",
        action: { type: "set-wallpaper", preset },
        thought: "Re-compositing wallpaper",
        reply: `Wallpaper set to ${preset.replace(/-/g, " ")}.`,
      };
    }
  }

  // ── Toggles ───────────────────────────────────────────────
  if (/(scan ?lines?)/.test(t) && /(toggle|on|off|hide|show|enable|disable)/.test(t)) {
    const value = /\b(off|hide|disable)\b/.test(t) ? false : /\b(on|show|enable)\b/.test(t) ? true : undefined;
    return {
      kind: "action",
      action: { type: "toggle-setting", setting: "scanlines", value },
      thought: "Adjusting HUD overlays",
      reply: "Scan lines adjusted.",
    };
  }

  if (/(particles?)/.test(t) && /(toggle|on|off|hide|show|enable|disable)/.test(t)) {
    const value = /\b(off|hide|disable)\b/.test(t) ? false : /\b(on|show|enable)\b/.test(t) ? true : undefined;
    return {
      kind: "action",
      action: { type: "toggle-setting", setting: "particles", value },
      thought: "Adjusting ambient particles",
      reply: "Ambient particles adjusted.",
    };
  }

  if (/(mute|silence|be quiet|stop talking|stop speaking|quiet)/.test(t)) {
    return {
      kind: "action",
      action: { type: "toggle-setting", setting: "voiceEnabled", value: false },
      thought: "Muting voice synthesis",
      reply: "Voice output muted. I'll keep to text.",
    };
  }

  if (/(unmute|voice on|enable voice|speak to me|talk to me)/.test(t)) {
    return {
      kind: "action",
      action: { type: "toggle-setting", setting: "voiceEnabled", value: true },
      thought: "Bringing voice synthesis online",
      reply: "Voice output enabled.",
    };
  }

  // ── System control ────────────────────────────────────────
  if (/\b(reboot|restart|reinitialise|reinitialize|reboot the system|restart the system)\b/.test(t)) {
    return {
      kind: "action",
      action: { type: "reboot" },
      thought: "Initiating warm reboot",
      reply: "Rebooting the neural core. Back in a moment.",
    };
  }

  if (/(clear|reset|wipe).*(session|desktop|windows|workspace)/.test(t)) {
    return {
      kind: "action",
      action: { type: "clear-session" },
      thought: "Clearing session state",
      reply: "Session cleared. Reloading the desktop.",
    };
  }

  if (/(export|download).*(logs?|activity|diagnostics|report)/.test(t)) {
    return {
      kind: "action",
      action: { type: "export-logs" },
      thought: "Compiling diagnostics export",
      reply: "Exporting the activity log now.",
    };
  }

  if (/(command palette|open palette|keyboard palette)/.test(t)) {
    return {
      kind: "action",
      action: { type: "open-palette" },
      thought: "Opening command palette",
      reply: "Command palette open.",
    };
  }

  // ── Windows / modules ─────────────────────────────────────
  if (/^(close|hide|dismiss|shut)\b/.test(t)) {
    if (/(all|everything|every window|windows|desktop)/.test(t)) {
      return {
        kind: "action",
        action: { type: "close-all-windows" },
        thought: "Closing all windows",
        reply: "All windows closed.",
      };
    }
    const moduleId = matchModule(t);
    if (moduleId) {
      return {
        kind: "action",
        action: { type: "close-module", moduleId },
        thought: `Closing ${moduleLabel(moduleId)}`,
        reply: `${moduleLabel(moduleId)} closed.`,
      };
    }
  }

  const openMatch = t.match(
    /^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:open|launch|run|start|show|bring up|go to|take me to|navigate to|switch to|focus)\s+(?:the\s+|my\s+|a\s+)?(.+?)(?:\s+(?:module|app|window|workspace|please|for me))?[.!]?$/
  );

  if (openMatch) {
    const target = openMatch[1].trim();
    const moduleId = matchModule(target);
    if (moduleId) {
      return {
        kind: "action",
        action: { type: "open-module", moduleId },
        thought: `Mounting ${moduleLabel(moduleId)}`,
        reply: pick([
          `Opening ${moduleLabel(moduleId)}, ${owner}.`,
          `${moduleLabel(moduleId)} coming online.`,
          `As you wish — ${moduleLabel(moduleId)} is up.`,
        ]),
      };
    }
  }

  const exactModule = matchModule(t);
  if (exactModule && t.split(" ").length <= 3) {
    return {
      kind: "action",
      action: { type: "open-module", moduleId: exactModule },
      thought: `Mounting ${moduleLabel(exactModule)}`,
      reply: `Opening ${moduleLabel(exactModule)}.`,
    };
  }

  // ── DJ library ────────────────────────────────────────────
  const libraryWord = /(library|collection|track ?list|(my )?(tracks|songs|tunes))/.test(t);
  const wantsLibraryStatus =
    libraryWord &&
    /(status|size|count|how many|stats|summary|report|what('s| is) in)/.test(t);

  if (wantsLibraryStatus) {
    const snapshot = getLibrarySnapshot();
    if (!snapshot || snapshot.trackCount === 0) {
      return {
        kind: "answer",
        reply:
          "Your DJ library is empty, " +
          owner +
          ". Open the DJ module and import your Traktor collection export — right-click the Collection in Traktor, choose Export Collection, save it as NML or CSV, then drop it into the DJ window.",
      };
    }

    const parts = [
      `Your DJ library holds ${snapshot.trackCount.toLocaleString("en-US")} tracks`,
    ];
    if (snapshot.bpmRange) {
      parts.push(
        `spanning ${Math.round(snapshot.bpmRange.min)}–${Math.round(snapshot.bpmRange.max)} BPM`
      );
    }
    if (snapshot.topKeys.length > 0) {
      parts.push(
        `most common keys ${snapshot.topKeys
          .map((entry) => `${entry.key} (${entry.count})`)
          .join(", ")}`
      );
    }
    const source = snapshot.fileName ? ` Imported from ${snapshot.fileName}.` : "";
    return {
      kind: "answer",
      reply: `${parts.join(", ")}.${source}${
        snapshot.persistent ? "" : " It is stored for this session only."
      }`,
    };
  }

  const hasTrackWord = /(tracks?|songs?|tunes?)/.test(t);
  const librarySearchIntent =
    hasTrackWord &&
    !/\b(add|remove|delete|play|queue|skip)\b/.test(t) &&
    /(find|search|look for|show|list|pull up|any|which|what|in|at|have|got)/.test(
      t
    );
  const bareFilterIntent =
    /\d{2,3}\s*bpm/.test(t) || /\bin\s+key\b/.test(t);

  if (librarySearchIntent || bareFilterIntent) {
    const snapshot = getLibrarySnapshot();
    if (!snapshot || snapshot.trackCount === 0) {
      return {
        kind: "answer",
        reply:
          "There is no DJ library loaded yet. Import your Traktor collection in the DJ module and I can search it by BPM and key.",
      };
    }

    const bpmRangeMatch = t.match(
      /(?:between\s+)?(\d{2,3})\s*(?:-|–|to|and)\s*(\d{2,3})\s*(?:bpm)?/
    );
    const singleBpmMatch = t.match(/(\d{2,3})\s*bpm/);
    const toleranceMatch = t.match(/[±+\-]\s*(\d{1,2})\s*bpm/);

    let minBpm: number | undefined;
    let maxBpm: number | undefined;

    if (bpmRangeMatch) {
      const first = Number(bpmRangeMatch[1]);
      const second = Number(bpmRangeMatch[2]);
      minBpm = Math.min(first, second);
      maxBpm = Math.max(first, second);
    } else if (singleBpmMatch) {
      const target = Number(singleBpmMatch[1]);
      const tolerance = toleranceMatch ? Number(toleranceMatch[1]) : 3;
      minBpm = target - tolerance;
      maxBpm = target + tolerance;
    }

    const camelotMatch = t.match(/\b(\d{1,2})\s*([ab])\b/);
    const musicalMatch = t.match(
      /\b([a-g][#b]?)\s*(minor|major|min|maj|m)\b/
    );
    const keyFilter = camelotMatch
      ? `${Number(camelotMatch[1])}${camelotMatch[2].toUpperCase()}`
      : musicalMatch
        ? toCamelot(`${musicalMatch[1]} ${musicalMatch[2]}`)
        : undefined;

    const stopWords = new Set([
      "find",
      "search",
      "look",
      "for",
      "show",
      "me",
      "list",
      "any",
      "which",
      "what",
      "tracks",
      "track",
      "songs",
      "song",
      "tunes",
      "tune",
      "in",
      "at",
      "my",
      "the",
      "a",
      "an",
      "do",
      "i",
      "have",
      "got",
      "are",
      "there",
      "is",
      "bpm",
      "key",
      "around",
      "about",
      "between",
      "and",
      "to",
      "of",
      "with",
    ]);
    const textFilter = t
      .replace(/(\d{2,3})\s*bpm/g, " ")
      .replace(/\b\d{1,2}\s*[ab]\b/g, " ")
      .replace(/\b[a-g][#b]?\s*(minor|major|min|maj|m)\b/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.has(word))
      .join(" ")
      .trim();

    const matches = snapshot.tracks.filter((track) => {
      if (minBpm !== undefined && (track.bpm === undefined || track.bpm < minBpm)) {
        return false;
      }
      if (maxBpm !== undefined && (track.bpm === undefined || track.bpm > maxBpm)) {
        return false;
      }
      if (keyFilter && track.camelot !== keyFilter) return false;
      if (textFilter) {
        const haystack = `${track.title} ${track.artist}`.toLowerCase();
        if (!textFilter.split(" ").every((word) => haystack.includes(word))) {
          return false;
        }
      }
      return true;
    });

    const filters: string[] = [];
    if (minBpm !== undefined && maxBpm !== undefined) {
      filters.push(`${Math.round(minBpm)}–${Math.round(maxBpm)} BPM`);
    }
    if (keyFilter) filters.push(`key ${keyFilter}`);
    if (textFilter) filters.push(`“${textFilter}”`);

    if (matches.length === 0) {
      return {
        kind: "answer",
        reply: `No tracks match ${filters.join(" and ") || "that search"} across your ${snapshot.trackCount.toLocaleString("en-US")} imported tracks.`,
      };
    }

    const lines = matches.slice(0, 5).map((track) => {
      const bpm = track.bpm ? `${Math.round(track.bpm)} BPM` : "no BPM";
      const key = track.camelot ? `, ${track.camelot}` : "";
      return `• ${track.artist} — ${track.title} (${bpm}${key})`;
    });

    const suffix =
      matches.length > 5 ? `\n…and ${matches.length - 5} more.` : "";
    return {
      kind: "answer",
      reply: `${matches.length} match${matches.length === 1 ? "" : "es"} for ${
        filters.join(" · ") || "your library"
      }:\n${lines.join("\n")}${suffix}`,
    };
  }

  if (
    /(set ?list|my set)\b/.test(t) &&
    /(what|show|list|how|which|status)/.test(t)
  ) {
    const setlists = loadSetlists();
    if (setlists.length === 0) {
      return {
        kind: "answer",
        reply:
          "You have no sets saved yet. Open the DJ module, create a set on the right, then add tracks from your library.",
      };
    }

    const snapshot = getLibrarySnapshot();
    const durationById = new Map(
      (snapshot?.tracks ?? []).map((track) => [track.id, track.durationSec ?? 0])
    );

    const summaries = setlists.slice(0, 3).map((setlist) => {
      const seconds = setlist.trackIds.reduce(
        (sum, id) => sum + (durationById.get(id) ?? 0),
        0
      );
      const runtime =
        seconds > 0 ? ` · ${Math.round(seconds / 60)} min` : "";
      return `• ${setlist.name}: ${setlist.trackIds.length} track${
        setlist.trackIds.length === 1 ? "" : "s"
      }${runtime}`;
    });

    return {
      kind: "answer",
      reply: `${setlists.length} saved set${setlists.length === 1 ? "" : "s"}:\n${summaries.join("\n")}`,
    };
  }

  // ── Information ───────────────────────────────────────────
  if (hasWord(t, "time") && /(what|whats|tell|current|check|know)/.test(t)) {
    return {
      kind: "answer",
      reply: `It's ${formatTime(now)}, ${owner}.`,
    };
  }

  if (/(what.*(date|day)|today'?s date|what day is it)/.test(t)) {
    return {
      kind: "answer",
      reply: `Today is ${formatDate(now)}.`,
    };
  }

  if (
    /(system status|status report|diagnostics|systems check|check systems|how are the systems|report|status)/.test(
      t
    )
  ) {
    const mode = ctx.providerIsLocal
      ? "local intelligence core (no external model connected)"
      : `${ctx.providerLabel} uplink`;
    return {
      kind: "answer",
      reply: [
        `All subsystems nominal, ${owner}.`,
        `Uptime is holding, ${ctx.openWindows} window${ctx.openWindows === 1 ? "" : "s"} open, active module ${moduleLabel(ctx.activeModule)}.`,
        `Running on the ${mode}. ${ctx.memoryCount} long-term memor${ctx.memoryCount === 1 ? "y" : "ies"} online.`,
      ].join(" "),
    };
  }

  if (
    /(what can you do|help|capabilities|commands|what are your functions|how do i use you)/.test(
      t
    )
  ) {
    return {
      kind: "answer",
      reply: `Here's what I can do, ${owner}:\n${JARVIS_CAPABILITIES.map((c) => `• ${c}`).join("\n")}`,
    };
  }

  if (/(who are you|what are you|introduce yourself|your name)/.test(t)) {
    return {
      kind: "answer",
      reply: `I'm JARVIS — Just A Rather Very Intelligent System. I run this desktop: windows, modules, themes, timers and memory. ${
        ctx.providerIsLocal
          ? "Right now I'm on the local core, so my conversation is limited — connect a model in Settings for open-ended answers."
          : `My language layer is currently backed by ${ctx.providerLabel}.`
      }`,
    };
  }

  if (/(which|what).*(model|provider|llm|ai).*(using|running|connected)/.test(t)) {
    return {
      kind: "answer",
      reply: ctx.providerIsLocal
        ? "I'm running on the built-in local core. No external model is connected — add a provider key in Settings → Intelligence to unlock open-ended conversation."
        : `I'm currently routed through ${ctx.providerLabel}.`,
    };
  }

  if (/(how are you|how'?s it going|you (ok|okay|alright))/.test(t)) {
    return {
      kind: "answer",
      reply: pick([
        "Operating within normal parameters. All cores green.",
        "Perfectly functional, thank you. Ready when you are.",
        `Running clean, ${owner}. What do you need?`,
      ]),
    };
  }

  if (/^(hi|hello|hey|yo|good morning|good afternoon|good evening|greetings)\b/.test(t)) {
    return {
      kind: "answer",
      reply: pick([
        `${greetingFor(now)}, ${owner}. All systems are online.`,
        `${greetingFor(now)}, ${owner}. What are we working on?`,
        `At your service, ${owner}.`,
      ]),
    };
  }

  if (/^(thanks|thank you|cheers|nice|great|good job|well done)\b/.test(t)) {
    return {
      kind: "answer",
      reply: pick([
        "Always, sir.",
        "That's what I'm here for.",
        "A pleasure, as ever.",
      ]),
    };
  }

  if (/(goodbye|bye|good night|goodnight|shut down|stand down)/.test(t)) {
    return {
      kind: "answer",
      reply: `Standing by, ${owner}. I'll keep the lights on.`,
    };
  }

  const mathCandidate = t
    .replace(/^(what('s| is)|calculate|compute|solve)\s+/, "")
    .replace(/[?=.!]+\s*$/, "");
  if (looksLikeMath(mathCandidate)) {
    const value = evaluateMath(mathCandidate);
    if (value !== null) {
      return {
        kind: "answer",
        reply: `${formatNumber(value)}.`,
      };
    }
  }

  return { kind: "chat" };
}

export function themeLabel(themeId: ThemeId | "next"): string {
  if (themeId === "next") return "next theme";
  return THEMES.find((t) => t.id === themeId)?.label ?? themeId;
}

export function nextTheme(current: string): ThemeId {
  const index = THEMES.findIndex((t) => t.id === current);
  return THEMES[(index + 1) % THEMES.length].id;
}

export function isWallpaperPreset(value: string): boolean {
  return (WALLPAPER_PRESETS as readonly string[]).includes(value);
}
