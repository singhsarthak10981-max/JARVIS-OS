// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { desktopPersistence } from "@/services/storage/DesktopPersistence";
import {
  buildDesktopSnapshot,
  type PersistableDesktopState,
} from "@/lib/desktop-snapshot";

const STORAGE_KEY = "jarvis-desktop-state";

function makeState(
  overrides: Partial<PersistableDesktopState> = {}
): PersistableDesktopState {
  return {
    windows: [
      {
        id: "w1",
        moduleId: "command-center",
        title: "Command Center",
        x: 100,
        y: 80,
        width: 1000,
        height: 760,
        minimized: false,
        maximized: false,
        zIndex: 1,
      },
    ],
    workspaces: [{ id: "ws1", name: "Main", icon: "◇", windowIds: ["w1"] }],
    activeWorkspaceId: "ws1",
    wallpaper: {
      type: "gradient",
      preset: "tactical-red",
      primaryColor: "#ff0033",
      secondaryColor: "#220000",
      accentColor: "#ff3355",
    },
    pinnedModules: ["command-center"],
    desktopShortcuts: [
      { id: "s1", moduleId: "dj", position: { x: 40, y: 60 } },
    ],
    ...overrides,
  };
}

/** Saves through the public API. */
function persist(state: PersistableDesktopState, debounced = false) {
  const snapshot = buildDesktopSnapshot(state);
  if (debounced) desktopPersistence.debouncedSave(snapshot);
  else desktopPersistence.save(snapshot);
}

function stored() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Counts writes to the desktop-state key only. */
function trackWrites() {
  const spy = vi.spyOn(Storage.prototype, "setItem");
  return {
    get count() {
      return spy.mock.calls.filter(([key]) => key === STORAGE_KEY).length;
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  desktopPersistence.setEnabled(true);
  localStorage.clear(); // drop the enabled flag write
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("debouncedSave", () => {
  it("coalesces rapid consecutive updates into a single write", () => {
    const writes = trackWrites();

    for (let x = 0; x < 60; x++) {
      persist(
        makeState({
          windows: [{ ...makeState().windows[0], x }],
        }),
        true
      );
    }

    // Nothing written while the user is still dragging.
    expect(writes.count).toBe(0);
    expect(desktopPersistence.hasPendingSave()).toBe(true);

    vi.advanceTimersByTime(400);

    expect(writes.count).toBe(1);
    // The newest value wins, not the first one queued.
    expect(stored().windows[0].bounds.x).toBe(59);
    expect(desktopPersistence.hasPendingSave()).toBe(false);
  });

  it("does not write twice for one burst", () => {
    const writes = trackWrites();
    persist(makeState(), true);
    vi.advanceTimersByTime(400);
    vi.advanceTimersByTime(5000);
    expect(writes.count).toBe(1);
  });
});

describe("flush", () => {
  it("writes a queued snapshot immediately (page hide / unload)", () => {
    const writes = trackWrites();
    persist(
      makeState({ windows: [{ ...makeState().windows[0], x: 321 }] }),
      true
    );

    // Simulates pagehide firing before the debounce window elapses.
    desktopPersistence.flush();

    expect(writes.count).toBe(1);
    expect(stored().windows[0].bounds.x).toBe(321);

    // The pending timer must be cancelled, not left to fire again.
    vi.advanceTimersByTime(1000);
    expect(writes.count).toBe(1);
  });

  it("is a no-op when nothing is queued", () => {
    const writes = trackWrites();
    desktopPersistence.flush();
    vi.advanceTimersByTime(1000);
    expect(writes.count).toBe(0);
  });
});

describe("full save", () => {
  it("supersedes a queued debounced snapshot instead of being overwritten", () => {
    const writes = trackWrites();

    persist(makeState({ activeWorkspaceId: "stale" }), true);
    persist(makeState({ activeWorkspaceId: "fresh" }));

    expect(stored().activeWorkspaceId).toBe("fresh");

    // A timer left in flight must not restore the stale snapshot.
    vi.advanceTimersByTime(1000);
    expect(stored().activeWorkspaceId).toBe("fresh");
    expect(writes.count).toBe(1);
    expect(desktopPersistence.hasPendingSave()).toBe(false);
  });
});

describe("reload round-trip", () => {
  it("restores every persisted field, including ones the window subscription does not observe", () => {
    persist(
      makeState({
        pinnedModules: ["dj", "settings"],
        desktopShortcuts: [
          { id: "s9", moduleId: "producer", position: { x: 220, y: 140 } },
        ],
        activeWorkspaceId: "ws2",
        wallpaper: {
          type: "solid",
          preset: "stealth",
          primaryColor: "#0a0a0a",
          secondaryColor: "#000000",
          accentColor: "#111111",
        },
      }),
      true
    );
    desktopPersistence.flush();

    // A fresh page load reads back what was written.
    const loaded = desktopPersistence.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.pinnedModules).toEqual(["dj", "settings"]);
    expect(loaded!.desktopShortcuts).toEqual([
      { id: "s9", moduleId: "producer", position: { x: 220, y: 140 } },
    ]);
    expect(loaded!.activeWorkspaceId).toBe("ws2");
    expect(loaded!.wallpaper.type).toBe("solid");
    expect(loaded!.workspaces[0].windowIds).toEqual(["w1"]);
  });

  it("keeps a minimised/maximised window state across a flush + reload", () => {
    persist(
      makeState({
        windows: [
          {
            ...makeState().windows[0],
            minimized: true,
            maximized: true,
            zIndex: 7,
          },
        ],
      }),
      true
    );
    desktopPersistence.flush();

    const loaded = desktopPersistence.load();
    expect(loaded!.windows[0].minimized).toBe(true);
    expect(loaded!.windows[0].maximized).toBe(true);
    expect(loaded!.windows[0].zIndex).toBe(7);
  });
});

describe("disabled persistence", () => {
  it("writes nothing and drops a queued snapshot", () => {
    desktopPersistence.setEnabled(false);
    const writes = trackWrites();

    persist(makeState(), true);
    vi.advanceTimersByTime(400);
    persist(makeState());

    expect(writes.count).toBe(0);
    expect(desktopPersistence.hasPendingSave()).toBe(false);
  });
});
