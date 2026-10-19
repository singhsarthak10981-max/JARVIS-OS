"use client";

export interface DesktopSnapshot {
  version: number;
  timestamp: number;
  windows: SerializedWindow[];
  workspaces: WorkspaceSnapshot[];
  activeWorkspaceId: string;
  wallpaper: WallpaperConfig;
  pinnedModules: string[];
  desktopShortcuts: DesktopShortcutConfig[];
}

export interface SerializedWindow {
  id: string;
  moduleId: string;
  title: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
}

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  icon: string;
  windowIds: string[];
}

export interface WallpaperConfig {
  type: "gradient" | "solid" | "animated";
  preset: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface DesktopShortcutConfig {
  id: string;
  moduleId: string;
  position: { x: number; y: number };
  label?: string;
}

const STORAGE_KEY = "jarvis-desktop-state";
const CURRENT_VERSION = 1;

/** Coalescing window for high-frequency changes (window drag/resize). */
const DEBOUNCE_MS = 400;

export class DesktopPersistence {
  private static instance: DesktopPersistence | null = null;
  private enabled: boolean = true;
  private lastSnapshot: DesktopSnapshot | null = null;

  static getInstance(): DesktopPersistence {
    if (!DesktopPersistence.instance) {
      DesktopPersistence.instance = new DesktopPersistence();
    }
    return DesktopPersistence.instance;
  }

  private constructor() {
    if (typeof window !== "undefined") {
      this.enabled =
        localStorage.getItem("jarvis-persistence-enabled") !== "false";
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("jarvis-persistence-enabled", String(enabled));
    }
  }

  save(snapshot: Omit<DesktopSnapshot, "version" | "timestamp">): void {
    // A full save supersedes any queued debounced snapshot. Cancel it so a
    // timer that is already in flight cannot overwrite fresher data.
    this.clearPending();
    if (!this.enabled || typeof window === "undefined") return;

    const fullSnapshot: DesktopSnapshot = {
      ...snapshot,
      version: CURRENT_VERSION,
      timestamp: Date.now(),
    };

    this.lastSnapshot = fullSnapshot;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullSnapshot));
    } catch (e) {
      console.warn("[DesktopPersistence] Failed to save:", e);
    }
  }

  /**
   * Coalesces bursts of high-frequency changes (window drag/resize) into a
   * single write. `pending` holds the latest snapshot so `flush()` can write it
   * immediately on drag end or when the page is being hidden.
   */
  private pending: Omit<DesktopSnapshot, "version" | "timestamp"> | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  debouncedSave(snapshot: Omit<DesktopSnapshot, "version" | "timestamp">): void {
    this.pending = snapshot;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this.flush();
    }, DEBOUNCE_MS);
  }

  /** Writes any queued snapshot now. Safe to call when nothing is queued. */
  flush(): void {
    const snapshot = this.pending;
    this.clearPending();
    if (!snapshot) return;
    this.save(snapshot);
  }

  /** Drops a queued snapshot and its timer without writing it. */
  private clearPending(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.pending = null;
  }

  /** True while a debounced write is queued. Used by tests. */
  hasPendingSave(): boolean {
    return this.pending !== null;
  }

  load(): DesktopSnapshot | null {
    if (typeof window === "undefined") return null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as DesktopSnapshot;

      if (parsed.version !== CURRENT_VERSION) {
        return this.migrate(parsed);
      }

      this.lastSnapshot = parsed;
      return parsed;
    } catch (e) {
      console.warn("[DesktopPersistence] Failed to load:", e);
      return null;
    }
  }

  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    this.lastSnapshot = null;
  }

  getLastSnapshot(): DesktopSnapshot | null {
    return this.lastSnapshot;
  }

  private migrate(data: DesktopSnapshot): DesktopSnapshot {
    const migrated = { ...data, version: CURRENT_VERSION };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }
}

export const desktopPersistence = DesktopPersistence.getInstance();
