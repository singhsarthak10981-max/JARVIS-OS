// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToPersistence } from "@/lib/desktop-snapshot";

const STORAGE_KEY = "jarvis-desktop-state";

type Store = Awaited<typeof import("@/lib/store")>["useAppStore"];

async function freshStore(): Promise<Store> {
  vi.resetModules();
  const mod = await import("@/lib/store");
  return mod.useAppStore;
}

/** Uses the real wiring shared with `components/desktop.tsx`. */
function wirePersistence(store: Store) {
  return subscribeToPersistence(store, () => {
    store.getState().saveDesktopStateDebounced();
  });
}

function stored() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("desktop persistence wiring", () => {
  it("persists a wallpaper change", async () => {
    const store = await freshStore();
    const unsubscribe = wirePersistence(store);

    store.getState().setWallpaper({
      type: "solid",
      preset: "stealth",
      primaryColor: "#0b0b0b",
      secondaryColor: "#000000",
      accentColor: "#111111",
    });

    expect(stored()).toBeNull(); // still debounced
    vi.advanceTimersByTime(400);

    expect(stored().wallpaper.type).toBe("solid");
    unsubscribe();
  });

  it("persists a change to pinned modules", async () => {
    const store = await freshStore();
    const unsubscribe = wirePersistence(store);

    // Every module is pinned by default, so unpinning is the real change.
    expect(store.getState().pinnedModules).toContain("bar");
    store.getState().unpinModule("bar");
    vi.advanceTimersByTime(400);

    expect(stored().pinnedModules).not.toContain("bar");
    unsubscribe();
  });

  it("persists desktop shortcuts and their positions", async () => {
    const store = await freshStore();
    const unsubscribe = wirePersistence(store);

    store.getState().addDesktopShortcut({
      id: "sc-1",
      moduleId: "producer",
      position: { x: 120, y: 240 },
    });
    vi.advanceTimersByTime(400);

    expect(stored().desktopShortcuts).toEqual([
      { id: "sc-1", moduleId: "producer", position: { x: 120, y: 240 } },
    ]);

    store.getState().updateDesktopShortcutPosition("sc-1", { x: 300, y: 90 });
    vi.advanceTimersByTime(400);

    expect(stored().desktopShortcuts[0].position).toEqual({ x: 300, y: 90 });
    unsubscribe();
  });

  it("persists the active workspace", async () => {
    const store = await freshStore();
    const unsubscribe = wirePersistence(store);

    store.getState().setActiveWorkspace("ws-2");
    vi.advanceTimersByTime(400);

    expect(stored().activeWorkspaceId).toBe("ws-2");
    unsubscribe();
  });

  it("still coalesces a burst of window moves into one write", async () => {
    const store = await freshStore();
    const unsubscribe = wirePersistence(store);

    store.getState().openWindow({
      id: "w1",
      moduleId: "command-center",
      title: "Command Center",
      icon: "◆",
      x: 0,
      y: 0,
      width: 900,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      minimized: false,
      maximized: false,
      resizable: true,
      closable: true,
      draggable: true,
    });

    const spy = vi.spyOn(Storage.prototype, "setItem");
    for (let x = 0; x < 40; x++) {
      store.getState().moveWindow("w1", x, x);
    }

    // No synchronous write per mousemove.
    expect(spy.mock.calls.filter(([k]) => k === STORAGE_KEY)).toHaveLength(0);

    vi.advanceTimersByTime(400);

    const writes = spy.mock.calls.filter(([k]) => k === STORAGE_KEY);
    expect(writes).toHaveLength(1);
    expect(stored().windows[0].bounds.x).toBe(39);
    unsubscribe();
  });

  it("writes the live state immediately on a full save (page hide)", async () => {
    const store = await freshStore();
    const unsubscribe = wirePersistence(store);

    // A queued, never-flushed change.
    store.getState().setWallpaper({
      type: "gradient",
      preset: "arc-reactor",
      primaryColor: "#33aaff",
      secondaryColor: "#001122",
      accentColor: "#66ccff",
    });

    // pagehide → saveDesktopState(), which must supersede the queued snapshot.
    store.getState().saveDesktopState();

    expect(stored().wallpaper.preset).toBe("arc-reactor");

    // The debounce timer must not later overwrite with stale data.
    store.getState().setWallpaper({
      type: "gradient",
      preset: "tactical-red",
      primaryColor: "#ff0033",
      secondaryColor: "#220000",
      accentColor: "#ff3355",
    });
    store.getState().saveDesktopState();
    vi.advanceTimersByTime(1000);

    expect(stored().wallpaper.preset).toBe("tactical-red");
    unsubscribe();
  });

  it("does not persist transient state such as activity or notifications", async () => {
    const store = await freshStore();
    const unsubscribe = wirePersistence(store);

    store.getState().logActivity("something happened", "info");
    store.getState().addNotification({ title: "Hi", message: "there", type: "info" });
    vi.advanceTimersByTime(400);

    expect(stored()).toBeNull();
    unsubscribe();
  });
});
