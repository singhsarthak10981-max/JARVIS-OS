// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SETTINGS_STORAGE_KEY = "jarvis-settings-v1";

type Store = Awaited<typeof import("@/lib/store")>["useAppStore"];

async function freshStore(): Promise<Store> {
  vi.resetModules();
  const mod = await import("@/lib/store");
  return mod.useAppStore;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("web search settings", () => {
  it("stores a boolean toggle and never a search key", async () => {
    const store = await freshStore();
    const settings = store.getState().settings as unknown as Record<string, unknown>;

    expect(settings.webSearchEnabled).toBe(true);

    store.getState().updateSettings({ webSearchEnabled: false });
    const raw = (localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "").toLowerCase();

    expect(raw).toContain('"websearchenabled":false');
    expect(raw).not.toContain("tavily");
    expect(raw).not.toContain("apikey");
  });
});

describe("memory setting", () => {
  it("is enabled by default for existing installations", async () => {
    const store = await freshStore();

    expect(store.getState().settings.memoryEnabled).toBe(true);
  });

  it("persists disabled mode without deleting saved facts", async () => {
    localStorage.setItem(
      "jarvis-memory-v1",
      JSON.stringify([
        { id: "mem-existing", text: "My preferred genre is R&B", createdAt: 1 },
      ])
    );

    const store = await freshStore();
    store.getState().updateSettings({ memoryEnabled: false });

    const savedSettings = JSON.parse(
      localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}"
    );
    expect(savedSettings.memoryEnabled).toBe(false);

    store.getState().hydrateSettings();
    expect(store.getState().settings.memoryEnabled).toBe(false);

    const savedMemories = JSON.parse(
      localStorage.getItem("jarvis-memory-v1") ?? "[]"
    );
    expect(savedMemories).toHaveLength(1);
    expect(savedMemories[0].text).toBe("My preferred genre is R&B");
  });
});

describe("API key persistence", () => {
  it("does not expose an api key field in default settings", async () => {
    const store = await freshStore();
    const settings = store.getState().settings as unknown as Record<string, unknown>;

    expect("aiApiKey" in settings).toBe(false);
  });

  it("never writes a credential to localStorage when settings change", async () => {
    const store = await freshStore();
    store.getState().updateSettings({ aiProvider: "google", aiModel: "gemini-3.8-flash" });

    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "";
    expect(raw).toContain("gemini-3.8-flash");
    expect(raw.toLowerCase()).not.toContain("apikey");
  });

  it("removes a legacy stored key on hydrate and keeps unrelated settings", async () => {
    // A record written by an older build, including the plaintext key.
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        aiProvider: "google",
        aiModel: "gemini-2.5-flash",
        aiApiKey: "AIza-LEGACY-SECRET-VALUE",
        aiBaseUrl: "https://example.invalid/v1",
        ownerName: "Sarthak",
        theme: "stealth",
        scanlines: false,
      })
    );

    const store = await freshStore();
    store.getState().hydrateSettings();

    // The unrelated settings survived.
    const settings = store.getState().settings;
    expect(settings.aiProvider).toBe("google");
    expect(settings.aiModel).toBe("gemini-2.5-flash");
    expect(settings.aiBaseUrl).toBe("https://example.invalid/v1");
    expect(settings.ownerName).toBe("Sarthak");
    expect(settings.theme).toBe("stealth");
    expect(settings.scanlines).toBe(false);

    // The secret is gone from the persisted record entirely.
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("AIza-LEGACY-SECRET-VALUE");
    expect(raw.toLowerCase()).not.toContain("aiapikey");

    // And it never entered the live state.
    expect("aiApiKey" in (settings as unknown as Record<string, unknown>)).toBe(false);
  });

  it("leaves a clean settings record untouched", async () => {
    const clean = { aiProvider: "openai", aiModel: "gpt-4o-mini" };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));

    const store = await freshStore();
    store.getState().hydrateSettings();

    expect(store.getState().settings.aiProvider).toBe("openai");
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toEqual(clean);
  });

  it("survives a corrupt settings record", async () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{not valid json");

    const store = await freshStore();
    expect(() => store.getState().hydrateSettings()).not.toThrow();
    expect(store.getState().settings.aiProvider).toBe("local");
  });
});

describe("desktop snapshot", () => {
  it("does not persist provider credentials in the desktop snapshot", async () => {
    const store = await freshStore();
    store.getState().updateSettings({ aiProvider: "google", aiModel: "gemini-3.8-flash" });
    store.getState().saveDesktopState();

    const raw = localStorage.getItem("jarvis-desktop-state") ?? "";
    expect(raw).not.toContain("aiApiKey");
    expect(raw).not.toContain("gemini-3.8-flash");
  });
});
