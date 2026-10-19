import type {
  DesktopShortcutConfig,
  DesktopSnapshot,
  WallpaperConfig,
} from "@/services/storage/DesktopPersistence";

/**
 * The subset of the app state that is persisted to disk.
 *
 * Every field listed here must also appear in `PERSISTED_KEYS` below, so the
 * change detector that triggers a save stays in sync with what is serialised.
 * Persisting a field that no trigger observes means the change is only written
 * by the next unrelated save — which loses it if the tab closes first.
 */
export interface PersistableDesktopState {
  windows: ReadonlyArray<{
    id: string;
    moduleId: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    minimized: boolean;
    maximized: boolean;
    zIndex: number;
  }>;
  workspaces: ReadonlyArray<{
    id: string;
    name: string;
    icon: string;
    windowIds: string[];
  }>;
  activeWorkspaceId: string;
  wallpaper: WallpaperConfig;
  pinnedModules: readonly string[];
  desktopShortcuts: readonly DesktopShortcutConfig[];
}

type SnapshotBody = Omit<DesktopSnapshot, "version" | "timestamp">;

/** Builds the serialisable snapshot from live app state. */
export function buildDesktopSnapshot(
  state: PersistableDesktopState
): SnapshotBody {
  return {
    windows: state.windows.map((w) => ({
      id: w.id,
      moduleId: w.moduleId,
      title: w.title,
      bounds: { x: w.x, y: w.y, width: w.width, height: w.height },
      minimized: w.minimized,
      maximized: w.maximized,
      zIndex: w.zIndex,
    })),
    workspaces: state.workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      icon: ws.icon,
      windowIds: ws.windowIds,
    })),
    activeWorkspaceId: state.activeWorkspaceId,
    wallpaper: state.wallpaper,
    pinnedModules: [...state.pinnedModules],
    desktopShortcuts: [...state.desktopShortcuts],
  };
}

/**
 * State slices that feed the snapshot. Order matters only for readability.
 * Kept as a single list so `buildDesktopSnapshot` and `persistedStateChanged`
 * cannot drift apart.
 */
export const PERSISTED_KEYS = [
  "windows",
  "workspaces",
  "activeWorkspaceId",
  "wallpaper",
  "pinnedModules",
  "desktopShortcuts",
] as const satisfies ReadonlyArray<keyof PersistableDesktopState>;

/**
 * True when a persisted slice changed identity. Zustand replaces changed
 * slices, so reference equality is both cheap and sufficient — this runs on
 * every store update, including each frame of a window drag.
 */
export function persistedStateChanged(
  prev: Pick<PersistableDesktopState, (typeof PERSISTED_KEYS)[number]>,
  next: Pick<PersistableDesktopState, (typeof PERSISTED_KEYS)[number]>
): boolean {
  return PERSISTED_KEYS.some((key) => prev[key] !== next[key]);
}

type PersistedKey = (typeof PERSISTED_KEYS)[number];

type PersistableSlice = Pick<PersistableDesktopState, PersistedKey>;

interface Subscribable<S> {
  subscribe: (listener: (state: S, prev: S) => void) => () => void;
}

/**
 * Wires "persist when a persisted slice changes" onto a store, without
 * subscribing any React component to the state. Returns the unsubscribe
 * function.
 *
 * Shared by `components/desktop.tsx` and the persistence tests so the two
 * cannot drift: a slice that is serialised but not observed here would only be
 * written by an unrelated later save.
 */
export function subscribeToPersistence<S extends PersistableSlice>(
  store: Subscribable<S>,
  save: () => void
): () => void {
  return store.subscribe((state, prev) => {
    if (!persistedStateChanged(prev, state)) return;
    save();
  });
}
