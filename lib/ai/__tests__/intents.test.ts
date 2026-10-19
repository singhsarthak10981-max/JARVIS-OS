import { afterEach, describe, expect, it } from "vitest";
import {
  parseDuration,
  resolveIntent,
  type IntentContext,
} from "../intents";
import {
  clearLibrarySnapshot,
  setLibrarySnapshot,
} from "@/services/library/libraryIndex";
import type { DjTrack } from "@/features/dj/types";

const context: IntentContext = {
  ownerName: "Sarthak",
  activeModule: "command-center",
  openWindows: 2,
  providerLabel: "local core",
  providerIsLocal: true,
  memoryCount: 2,
  memories: [
    "my studio is in Madrid",
    "the bar opens at 7pm",
  ],
  currentTheme: "tactical-red",
  now: new Date("2026-10-19T20:30:00Z"),
};

function resolve(input: string) {
  return resolveIntent(input, context);
}

describe("module control", () => {
  it("opens a module from a natural command", () => {
    expect(resolve("open the DJ module")).toMatchObject({
      kind: "action",
      action: { type: "open-module", moduleId: "dj" },
    });
  });

  it("understands wake-word prefixes and synonyms", () => {
    expect(resolve("hey jarvis, open the producer studio")).toMatchObject({
      action: { type: "open-module", moduleId: "producer" },
    });
  });

  it("opens a module when the name is the whole command", () => {
    expect(resolve("settings")).toMatchObject({
      action: { type: "open-module", moduleId: "settings" },
    });
  });

  it("closes a specific module", () => {
    expect(resolve("close the settings window")).toMatchObject({
      action: { type: "close-module", moduleId: "settings" },
    });
  });

  it("closes every window", () => {
    expect(resolve("close all windows")).toMatchObject({
      action: { type: "close-all-windows" },
    });
  });

  it("does not mistake conversation for an open command", () => {
    expect(resolve("open up about your day")).toMatchObject({ kind: "chat" });
    expect(resolve("what is the weather like?")).toMatchObject({ kind: "chat" });
  });
});

describe("DJ launch phrasings", () => {
  it.each([
    "Hey JARVIS, open DJ mode",
    "let me groove",
    "let's open my DJ setup",
    "let's mix",
    "time to groove",
    "I want to mix",
  ])("opens the DJ workspace for %s", (phrase) => {
    expect(resolve(phrase)).toMatchObject({
      kind: "action",
      action: { type: "open-module", moduleId: "dj" },
    });
  });

  it("treats Rekordbox as the DJ workspace plus a launch request", () => {
    for (const phrase of ["Open Rekordbox", "open my rekordbox", "launch rekordbox"]) {
      expect(resolve(phrase)).toMatchObject({
        kind: "action",
        action: {
          type: "open-module",
          moduleId: "dj",
          launch: "rekordbox",
        },
      });
    }
  });

  it("never claims Rekordbox launched without the bridge", () => {
    const result = resolve("Open Rekordbox");
    expect(result.reply).toMatch(/bridge/i);
    expect(result.reply).not.toMatch(/launched rekordbox|rekordbox is open/i);
  });

  it("opens the performance surface directly", () => {
    for (const phrase of [
      "open performance view",
      "Hey JARVIS, open performance view",
      "enter performance mode",
      "show me the performance screen",
    ]) {
      expect(resolve(phrase)).toMatchObject({
        kind: "action",
        action: { type: "open-module", moduleId: "dj", view: "performance" },
      });
    }
  });

  it("exits the performance surface", () => {
    expect(resolve("exit performance view")).toMatchObject({
      action: { type: "set-dj-view", view: "launchpad" },
    });
    expect(resolve("Hey JARVIS, close the performance view")).toMatchObject({
      action: { type: "set-dj-view", view: "launchpad" },
    });
  });

  it("recommends tracks by energy/BPM from the real library", () => {
    setLibrarySnapshot([
      { id: "a", title: "Midnight Drive", artist: "Kessler", bpm: 128, camelot: "8A", durationSec: 372 },
      { id: "b", title: "Night Bus", artist: "Sable", bpm: 126, camelot: "9B", durationSec: 341 },
    ] as never);

    const result = resolve("recommend energy 126");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("Night Bus");
    expect(result.reply).toContain("126");

    clearLibrarySnapshot();
  });

  it("does not invent a recommendation without a library", () => {
    clearLibrarySnapshot();
    const result = resolve("recommend energy 126");
    expect(result.kind).toBe("answer");
    expect(result.reply).toMatch(/import/i);
  });

  it("keeps other modules unaffected by the new aliases", () => {
    expect(resolve("open the producer")).toMatchObject({
      action: { type: "open-module", moduleId: "producer" },
    });
    expect(resolve("open the bar")).toMatchObject({
      action: { type: "open-module", moduleId: "bar" },
    });
  });
});

describe("appearance", () => {
  it("switches to a named theme", () => {
    expect(resolve("switch to stealth theme")).toMatchObject({
      action: { type: "set-theme", theme: "stealth" },
    });
  });

  it("cycles themes when none is named", () => {
    expect(resolve("change the theme")).toMatchObject({
      action: { type: "set-theme", theme: "next" },
    });
  });

  it("recognizes a theme without the word theme", () => {
    expect(resolve("switch to arc reactor")).toMatchObject({
      action: { type: "set-theme", theme: "arc-reactor" },
    });
  });

  it.each(["switch to Stark Interface theme", "use the Iron Man theme", "switch to Jarvis blue"])(
    "selects the Stark Interface theme from the command %s",
    (command) => {
      expect(resolve(command)).toMatchObject({
        action: { type: "set-theme", theme: "stark-interface" },
      });
    }
  );

  it("keeps the shorter blue alias mapped to Arc Reactor", () => {
    expect(resolve("switch to blue theme")).toMatchObject({
      action: { type: "set-theme", theme: "arc-reactor" },
    });
  });

  it("changes the wallpaper preset", () => {
    expect(resolve("set the wallpaper to emerald")).toMatchObject({
      action: { type: "set-wallpaper", preset: "emerald" },
    });
  });

  it("toggles scanlines with an explicit value", () => {
    expect(resolve("enable scanlines")).toMatchObject({
      action: { type: "toggle-setting", setting: "scanlines", value: true },
    });
  });

  it("mutes voice output", () => {
    expect(resolve("mute")).toMatchObject({
      action: { type: "toggle-setting", setting: "voiceEnabled", value: false },
    });
  });
});

describe("timers", () => {
  it("parses seconds, minutes and hours", () => {
    expect(parseDuration("set a timer for 5 minutes")).toBe(300);
    expect(parseDuration("remind me in 90 seconds")).toBe(90);
    expect(parseDuration("timer for 2 hours")).toBe(7200);
    expect(parseDuration("for 1 hour 30 minutes")).toBe(5400);
    expect(parseDuration("no duration here")).toBeNull();
  });

  it("arms a timer with a label", () => {
    expect(resolve("remind me in 2 hours to call the studio")).toMatchObject({
      action: {
        type: "start-timer",
        seconds: 7200,
        label: "call the studio",
      },
    });
  });

  it("cancels timers", () => {
    expect(resolve("cancel all timers")).toMatchObject({
      action: { type: "cancel-timers" },
    });
  });

  it("asks for a duration instead of guessing", () => {
    const result = resolve("set a timer");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("duration");
  });
});

describe("memory", () => {
  it("stores a fact", () => {
    const result = resolve("remember that the studio lights are on channel 4");
    expect(result.action).toEqual({
      type: "remember",
      fact: "the studio lights are on channel 4",
    });
  });

  it("recalls stored facts", () => {
    const result = resolve("what do you remember?");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("my studio is in Madrid");
  });

  it("wipes memory on request", () => {
    expect(resolve("forget everything")).toMatchObject({
      action: { type: "forget-memory" },
    });
  });
});

describe("information", () => {
  it("reports the time", () => {
    const result = resolve("what time is it?");
    expect(result.kind).toBe("answer");
    expect(result.reply).toMatch(/\d{2}:\d{2}/);
  });

  it("reports system status with live context", () => {
    const result = resolve("system status report");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("2 windows open");
    expect(result.reply).toContain("local intelligence core");
  });

  it("lists capabilities", () => {
    const result = resolve("what can you do?");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("Open, close and switch modules");
  });

  it("introduces itself", () => {
    const result = resolve("who are you?");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("JARVIS");
  });

  it("greets the owner by name", () => {
    const result = resolve("hello");
    expect(result.reply).toContain("Sarthak");
  });

  it("solves arithmetic", () => {
    const result = resolve("what is 12 * 7 + 2?");
    expect(result.kind).toBe("answer");
    expect(result.reply).toBe("86.");
  });
});

describe("system", () => {
  it("reboots", () => {
    expect(resolve("reboot the system")).toMatchObject({
      action: { type: "reboot" },
    });
  });

  it("exports diagnostics", () => {
    expect(resolve("export the logs")).toMatchObject({
      action: { type: "export-logs" },
    });
  });

  it("opens the command palette", () => {
    expect(resolve("open the command palette")).toMatchObject({
      action: { type: "open-palette" },
    });
  });
});

describe("DJ library intents", () => {
  const tracks: DjTrack[] = [
    {
      id: "t1",
      title: "Midnight Drive",
      artist: "Kessler",
      bpm: 128,
      key: "A minor",
      camelot: "8A",
      durationSec: 372,
    },
    {
      id: "t2",
      title: "Low End Theory",
      artist: "Ren",
      bpm: 132,
      key: "E major",
      camelot: "12B",
      durationSec: 290,
    },
    {
      id: "t3",
      title: "Sundown",
      artist: "Kessler",
      bpm: 122,
      key: "A minor",
      camelot: "8A",
      durationSec: 304,
    },
  ];

  afterEach(() => {
    clearLibrarySnapshot();
  });

  it("explains how to import when the library is empty", () => {
    const result = resolve("how many tracks are in my library?");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("empty");
    expect(result.reply).toContain("Traktor");
  });

  it("reports library status with BPM range and top keys", () => {
    setLibrarySnapshot(tracks, { fileName: "collection.nml", persistent: true });
    const result = resolve("library status");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("3 tracks");
    expect(result.reply).toContain("122–132 BPM");
    expect(result.reply).toContain("8A");
    expect(result.reply).toContain("collection.nml");
  });

  it("searches by BPM with a tolerance window", () => {
    setLibrarySnapshot(tracks, { persistent: true });
    const result = resolve("find tracks at 128 bpm");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("Midnight Drive");
    expect(result.reply).not.toContain("Sundown");
  });

  it("filters by Camelot key", () => {
    setLibrarySnapshot(tracks, { persistent: true });
    const result = resolve("tracks in 8A");
    expect(result.reply).toContain("Midnight Drive");
    expect(result.reply).toContain("Sundown");
    expect(result.reply).not.toContain("Low End Theory");
  });

  it("filters by musical key", () => {
    setLibrarySnapshot(tracks, { persistent: true });
    const result = resolve("find tracks in E major");
    expect(result.reply).toContain("Low End Theory");
    expect(result.reply).not.toContain("Midnight Drive");
  });

  it("searches free text across artist and title", () => {
    setLibrarySnapshot(tracks, { persistent: true });
    const result = resolve("find tracks for kessler");
    expect(result.reply).toContain("2 matches");
    expect(result.reply).toContain("Midnight Drive");
  });

  it("reports no matches without inventing results", () => {
    setLibrarySnapshot(tracks, { persistent: true });
    const result = resolve("find tracks at 175 bpm");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("No tracks match");
  });

  it("does not hijack module navigation", () => {
    setLibrarySnapshot(tracks, { persistent: true });
    expect(resolve("open the DJ module")).toMatchObject({
      action: { type: "open-module", moduleId: "dj" },
    });
  });

  it("explains that no sets exist", () => {
    const result = resolve("what's in my setlist?");
    expect(result.kind).toBe("answer");
    expect(result.reply).toContain("no sets");
  });
});

describe("capability requests", () => {
  /**
   * The two long prompts that previously returned the fixed capability list
   * because they happened to contain the word "help" / "capabilities".
   * They are ordinary conversational questions and must reach the model.
   */
  const LONG_CAPABILITY_PROMPTS = [
    "Can you help me debug why my Next.js settings store rehydrates twice in development and explain what the root cause usually is?",
    "Explain the capabilities and limitations of the current AI provider architecture, especially how missing credentials and the local fallback are handled.",
  ];

  it("answers a direct, short help request with the capability list", () => {
    for (const prompt of ["what can you do?", "help", "what are your capabilities?"]) {
      const result = resolve(prompt);
      expect(result.kind).toBe("answer");
      expect(result.reply).toContain("Open, close and switch modules");
    }
  });

  it.each(LONG_CAPABILITY_PROMPTS)(
    "sends a long capability question to the model: %s",
    (prompt) => {
      expect(resolve(prompt).kind).toBe("chat");
    }
  );

  it("does not intercept a message that merely mentions capabilities", () => {
    expect(
      resolve("I've been reading about agent capabilities lately and I'm curious how they're benchmarked")
        .kind
    ).toBe("chat");
  });

  it("keeps the introduction intent from swallowing a capability question", () => {
    expect(resolve("what are you capable of?").kind).toBe("chat");
    expect(resolve("who are you?").kind).toBe("answer");
  });

  it("still runs deterministic desktop commands", () => {
    expect(resolve("open the producer module")).toMatchObject({
      action: { type: "open-module", moduleId: "producer" },
    });
    expect(resolve("set a timer for 5 minutes")).toMatchObject({
      action: { type: "start-timer", seconds: 300 },
    });
    expect(resolve("switch to the stealth theme")).toMatchObject({
      action: { type: "set-theme", theme: "stealth" },
    });
    expect(resolve("remember that the studio lights are on channel 4")).toMatchObject({
      action: { type: "remember", fact: "the studio lights are on channel 4" },
    });
  });

  it("does not treat a long help request as a menu", () => {
    expect(
      resolve("help me understand how React Server Components decide what to stream first")
        .kind
    ).toBe("chat");
  });
});
