import { describe, expect, it } from "vitest";
import {
  PERSISTED_KEYS,
  buildDesktopSnapshot,
  persistedStateChanged,
  type PersistableDesktopState,
} from "@/lib/desktop-snapshot";

function makeState(
  overrides: Partial<PersistableDesktopState> = {}
): PersistableDesktopState {
  return {
    windows: [
      {
        id: "w1",
        moduleId: "dj",
        title: "DJ Workspace",
        x: 10,
        y: 20,
        width: 800,
        height: 600,
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
    pinnedModules: ["dj"],
    desktopShortcuts: [
      { id: "s1", moduleId: "dj", position: { x: 40, y: 60 } },
    ],
    ...overrides,
  };
}

describe("buildDesktopSnapshot", () => {
  it("serialises window bounds as x/y/width/height", () => {
    const snapshot = buildDesktopSnapshot(makeState());
    expect(snapshot.windows[0]).toEqual({
      id: "w1",
      moduleId: "dj",
      title: "DJ Workspace",
      bounds: { x: 10, y: 20, width: 800, height: 600 },
      minimized: false,
      maximized: false,
      zIndex: 1,
    });
  });

  it("includes every persisted field", () => {
    const snapshot = buildDesktopSnapshot(makeState());
    expect(snapshot.workspaces).toEqual([
      { id: "ws1", name: "Main", icon: "◇", windowIds: ["w1"] },
    ]);
    expect(snapshot.activeWorkspaceId).toBe("ws1");
    expect(snapshot.wallpaper.preset).toBe("tactical-red");
    expect(snapshot.pinnedModules).toEqual(["dj"]);
    expect(snapshot.desktopShortcuts).toEqual([
      { id: "s1", moduleId: "dj", position: { x: 40, y: 60 } },
    ]);
  });

  it("keeps PERSISTED_KEYS in lockstep with the serialised snapshot", () => {
    // Drift guard: a field added to the snapshot but not to PERSISTED_KEYS
    // would only be saved when some unrelated change triggered a write.
    const snapshotKeys = Object.keys(buildDesktopSnapshot(makeState())).sort();
    expect(snapshotKeys).toEqual([...PERSISTED_KEYS].sort());
  });

  it("copies arrays instead of aliasing live state", () => {
    const state = makeState();
    const snapshot = buildDesktopSnapshot(state);
    expect(snapshot.pinnedModules).not.toBe(state.pinnedModules);
    expect(snapshot.desktopShortcuts).not.toBe(state.desktopShortcuts);
  });
});

describe("persistedStateChanged", () => {
  it("detects a change to every persisted slice", () => {
    const base = makeState();

    const variants: Partial<PersistableDesktopState>[] = [
      { windows: [] },
      { workspaces: [] },
      { activeWorkspaceId: "ws2" },
      { wallpaper: { ...base.wallpaper, preset: "arc-reactor" } },
      { pinnedModules: ["bar"] },
      { desktopShortcuts: [] },
    ];

    for (const variant of variants) {
      expect(persistedStateChanged(base, makeState(variant))).toBe(true);
    }
  });

  it("ignores updates that leave every persisted slice untouched", () => {
    const base = makeState();
    // A shallow clone shares every slice reference, which is what Zustand
    // produces for unrelated updates (notifications, activity, AI state...).
    expect(persistedStateChanged(base, { ...base })).toBe(false);
    expect(persistedStateChanged(base, base)).toBe(false);
  });

  it("treats an emptied window list as a change", () => {
    // Closing the last window must persist, otherwise a reload resurrects it.
    const base = makeState();
    expect(
      persistedStateChanged(base, makeState({ windows: [], workspaces: [] }))
    ).toBe(true);
  });
});
