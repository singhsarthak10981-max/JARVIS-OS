import { create } from "zustand";
import type { ModuleId } from "./modules";
import type { WindowInstance, WindowBounds, SnapPosition } from "@/types/window";
import type { Workspace } from "./workspaces";
import type { WallpaperConfig, DesktopShortcutConfig } from "@/services/storage/DesktopPersistence";
import { desktopPersistence } from "@/services/storage/DesktopPersistence";

// ── AI State ──────────────────────────────────────────────

export type AiState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "executing"
  | "offline"
  | "error";

export type BootStage =
  | "neural-core"
  | "memory"
  | "voice"
  | "modules"
  | "ai-services"
  | "greeting"
  | "complete";

// ── Notifications ─────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: number;
  read: boolean;
}

// ── Settings ──────────────────────────────────────────────

export interface SettingsState {
  scanlines: boolean;
  particles: boolean;
  soundEnabled: boolean;
  volume: number;
  theme: "tactical-red" | "arc-reactor" | "stealth";
}

// ── Store ─────────────────────────────────────────────────

export interface AppState {
  // Navigation
  activeModule: ModuleId;
  navigate: (id: ModuleId) => void;

  // Command Palette
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  // Boot
  booted: boolean;
  bootProgress: number;
  bootStage: BootStage;
  setBootProgress: (p: number) => void;
  setBootStage: (s: BootStage) => void;
  completeBoot: () => void;

  // AI
  aiState: AiState;
  setAiState: (s: AiState) => void;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  lastInteraction: number;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  dismissNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Settings
  settings: SettingsState;
  updateSettings: (partial: Partial<SettingsState>) => void;

  // Debug
  debugOpen: boolean;
  toggleDebug: () => void;

  // Dock / Pinned Modules
  pinnedModules: ModuleId[];
  pinModule: (id: ModuleId) => void;
  unpinModule: (id: ModuleId) => void;

  // Workspaces
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;

  // Wallpaper
  wallpaper: WallpaperConfig;
  setWallpaper: (config: WallpaperConfig) => void;

  // Persistence
  persistenceEnabled: boolean;
  restoreSession: boolean;
  setPersistenceEnabled: (enabled: boolean) => void;
  setRestoreSession: (restore: boolean) => void;
  saveDesktopState: () => void;
  loadDesktopState: () => void;

  // Desktop Shortcuts
  desktopShortcuts: DesktopShortcutConfig[];
  addDesktopShortcut: (shortcut: DesktopShortcutConfig) => void;
  removeDesktopShortcut: (id: string) => void;
  updateDesktopShortcutPosition: (id: string, position: { x: number; y: number }) => void;

  // Windows
  windows: WindowInstance[];
  focusedWindow: string | null;
  highestZ: number;
  openWindow: (win: Omit<WindowInstance, "zIndex" | "focused" | "previousBounds" | "isSnapped" | "snapPosition">) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  setWindowBounds: (id: string, bounds: Partial<WindowBounds>) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  snapWindow: (id: string, position: SnapPosition, containerWidth: number, containerHeight: number) => void;
  bringToFront: (id: string) => void;
  closeAll: () => void;
}

let notifCounter = 0;

export const useAppStore = create<AppState>((set) => ({
  // ── Navigation ──────────────────────────────────────────
  activeModule: "command-center",
  navigate: (id) => set({ activeModule: id }),

  // ── Command Palette ─────────────────────────────────────
  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  // ── Boot ────────────────────────────────────────────────
  booted: false,
  bootProgress: 0,
  bootStage: "neural-core",
  setBootProgress: (p) => set({ bootProgress: p }),
  setBootStage: (s) => set({ bootStage: s }),
  completeBoot: () => set({ booted: true, bootProgress: 100, bootStage: "complete" }),

  // ── AI ──────────────────────────────────────────────────
  aiState: "idle",
  setAiState: (s) =>
    set({
      aiState: s,
      isListening: s === "listening",
      isThinking: s === "thinking",
      isSpeaking: s === "speaking",
      lastInteraction: Date.now(),
    }),
  isListening: false,
  isThinking: false,
  isSpeaking: false,
  lastInteraction: 0,

  // ── Notifications ───────────────────────────────────────
  notifications: [],
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        {
          ...n,
          id: `notif-${++notifCounter}`,
          timestamp: Date.now(),
          read: false,
        },
        ...s.notifications,
      ],
    })),
  dismissNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  clearNotifications: () => set({ notifications: [] }),

  // ── Settings ────────────────────────────────────────────
  settings: {
    scanlines: true,
    particles: true,
    soundEnabled: false,
    volume: 75,
    theme: "tactical-red",
  },
  updateSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),

  // ── Debug ───────────────────────────────────────────────
  debugOpen: false,
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),

  // ── Dock / Pinned Modules ──────────────────────────────
  pinnedModules: [
    "command-center",
    "dj",
    "producer",
    "bar",
    "business",
    "settings",
  ],
  pinModule: (id) =>
    set((s) => ({
      pinnedModules: s.pinnedModules.includes(id)
        ? s.pinnedModules
        : [...s.pinnedModules, id],
    })),
  unpinModule: (id) =>
    set((s) => ({
      pinnedModules: s.pinnedModules.filter((m) => m !== id),
    })),

  // ── Workspaces ─────────────────────────────────────────
  workspaces: [
    { id: "workspace-main", name: "Main", icon: "◆", windowIds: [] },
    { id: "workspace-production", name: "Production", icon: "♫", windowIds: [] },
    { id: "workspace-business", name: "Business", icon: "▣", windowIds: [] },
    { id: "workspace-creative", name: "Creative", icon: "★", windowIds: [] },
  ],
  activeWorkspaceId: "workspace-main",
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  addWorkspace: (workspace) =>
    set((s) => ({
      workspaces: [...s.workspaces, workspace],
    })),
  removeWorkspace: (id) =>
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? "workspace-main" : s.activeWorkspaceId,
    })),
  renameWorkspace: (id, name) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id ? { ...w, name } : w
      ),
    })),

  // ── Wallpaper ──────────────────────────────────────────
  wallpaper: {
    type: "gradient",
    preset: "tactical-red",
    primaryColor: "#ff0033",
    secondaryColor: "#1a0008",
    accentColor: "#ff0033",
  },
  setWallpaper: (config) => set({ wallpaper: config }),

  // ── Persistence ────────────────────────────────────────
  persistenceEnabled: true,
  restoreSession: true,
  setPersistenceEnabled: (enabled) => {
    desktopPersistence.setEnabled(enabled);
    set({ persistenceEnabled: enabled });
  },
  setRestoreSession: (restore) => set({ restoreSession: restore }),
  saveDesktopState: () => {
    const state = useAppStore.getState();
    desktopPersistence.save({
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
      pinnedModules: state.pinnedModules,
      desktopShortcuts: state.desktopShortcuts,
    });
  },
  loadDesktopState: () => {
    const snapshot = desktopPersistence.load();
    if (!snapshot) return;

    const state = useAppStore.getState();

    // Restore wallpaper
    if (snapshot.wallpaper) {
      state.setWallpaper(snapshot.wallpaper);
    }

    // Restore pinned modules
    if (snapshot.pinnedModules && snapshot.pinnedModules.length > 0) {
      set({ pinnedModules: snapshot.pinnedModules as ModuleId[] });
    }

    // Restore desktop shortcuts
    if (snapshot.desktopShortcuts) {
      set({ desktopShortcuts: snapshot.desktopShortcuts });
    }

    // Restore workspaces
    if (snapshot.workspaces && snapshot.workspaces.length > 0) {
      set({
        workspaces: snapshot.workspaces.map((ws) => ({
          ...ws,
          windowIds: ws.windowIds || [],
        })),
        activeWorkspaceId: snapshot.activeWorkspaceId || "workspace-main",
      });
    }

    // Restore windows
    if (snapshot.windows && snapshot.windows.length > 0) {
      let maxZ = 0;
      const restoredWindows = snapshot.windows.map((w) => {
        const z = w.zIndex;
        if (z > maxZ) maxZ = z;
        return {
          id: w.id,
          moduleId: w.moduleId as ModuleId,
          title: w.title,
          x: w.bounds.x,
          y: w.bounds.y,
          width: w.bounds.width,
          height: w.bounds.height,
          minimized: w.minimized,
          maximized: w.maximized,
          zIndex: z,
          focused: false,
          previousBounds: null,
          isSnapped: false,
          snapPosition: null,
          minWidth: 400,
          minHeight: 300,
          resizable: true,
          closable: true,
          draggable: true,
        };
      });
      set({ windows: restoredWindows, highestZ: maxZ });
    }
  },

  // ── Desktop Shortcuts ──────────────────────────────────
  desktopShortcuts: [],
  addDesktopShortcut: (shortcut) =>
    set((s) => ({
      desktopShortcuts: [...s.desktopShortcuts, shortcut],
    })),
  removeDesktopShortcut: (id) =>
    set((s) => ({
      desktopShortcuts: s.desktopShortcuts.filter((sc) => sc.id !== id),
    })),
  updateDesktopShortcutPosition: (id, position) =>
    set((s) => ({
      desktopShortcuts: s.desktopShortcuts.map((sc) =>
        sc.id === id ? { ...sc, position } : sc
      ),
    })),

  // ── Windows ────────────────────────────────────────────
  windows: [],
  focusedWindow: null,
  highestZ: 0,

  openWindow: (win) =>
    set((s) => {
      const newZ = s.highestZ + 1;
      const newWindow: WindowInstance = {
        ...win,
        zIndex: newZ,
        focused: true,
        previousBounds: null,
        isSnapped: false,
        snapPosition: null,
      };
      return {
        windows: [
          ...s.windows.map((w) => ({ ...w, focused: false })),
          newWindow,
        ],
        focusedWindow: newWindow.id,
        highestZ: newZ,
      };
    }),

  closeWindow: (id) =>
    set((s) => {
      const remaining = s.windows.filter((w) => w.id !== id);
      const wasFocused = s.focusedWindow === id;
      const topWindow =
        remaining.length > 0
          ? remaining.reduce((a, b) => (a.zIndex > b.zIndex ? a : b))
          : null;
      return {
        windows: remaining.map((w) =>
          w.id === topWindow?.id ? { ...w, focused: true } : w
        ),
        focusedWindow: wasFocused ? topWindow?.id ?? null : s.focusedWindow,
      };
    }),

  focusWindow: (id) =>
    set((s) => {
      const newZ = s.highestZ + 1;
      return {
        windows: s.windows.map((w) =>
          w.id === id
            ? { ...w, focused: true, zIndex: newZ, minimized: false }
            : { ...w, focused: false }
        ),
        focusedWindow: id,
        highestZ: newZ,
      };
    }),

  moveWindow: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, x, y, isSnapped: false, snapPosition: null } : w
      ),
    })),

  resizeWindow: (id, width, height) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              width: Math.max(w.minWidth, width),
              height: Math.max(w.minHeight, height),
              isSnapped: false,
              snapPosition: null,
            }
          : w
      ),
    })),

  setWindowBounds: (id, bounds) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...(bounds.x !== undefined && { x: bounds.x }),
              ...(bounds.y !== undefined && { y: bounds.y }),
              ...(bounds.width !== undefined && {
                width: Math.max(w.minWidth, bounds.width),
              }),
              ...(bounds.height !== undefined && {
                height: Math.max(w.minHeight, bounds.height),
              }),
              isSnapped: false,
              snapPosition: null,
            }
          : w
      ),
    })),

  minimizeWindow: (id) =>
    set((s) => {
      const remaining = s.windows.filter((w) => w.id !== id && !w.minimized);
      const topWindow =
        remaining.length > 0
          ? remaining.reduce((a, b) => (a.zIndex > b.zIndex ? a : b))
          : null;
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, minimized: true, focused: false } : w
        ),
        focusedWindow: s.focusedWindow === id ? topWindow?.id ?? null : s.focusedWindow,
      };
    }),

  maximizeWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        const isAlreadyMaximized = w.maximized;
        if (isAlreadyMaximized) {
          // Restore previous bounds
          const prev = w.previousBounds;
          return {
            ...w,
            maximized: false,
            previousBounds: null,
            isSnapped: false,
            snapPosition: null,
            ...(prev && {
              x: prev.x,
              y: prev.y,
              width: prev.width,
              height: prev.height,
            }),
          };
        }
        // Save current bounds and maximize
        return {
          ...w,
          maximized: true,
          previousBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
          isSnapped: false,
          snapPosition: null,
        };
      }),
    })),

  restoreWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        const prev = w.previousBounds;
        return {
          ...w,
          maximized: false,
          isSnapped: false,
          snapPosition: null,
          ...(prev && {
            x: prev.x,
            y: prev.y,
            width: prev.width,
            height: prev.height,
          }),
          previousBounds: null,
        };
      }),
    })),

  snapWindow: (id, position, containerWidth, containerHeight) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (position === null) {
          // Restore from snap
          const prev = w.previousBounds;
          return {
            ...w,
            isSnapped: false,
            snapPosition: null,
            maximized: false,
            ...(prev && {
              x: prev.x,
              y: prev.y,
              width: prev.width,
              height: prev.height,
            }),
            previousBounds: null,
          };
        }
        if (position === "maximized") {
          return {
            ...w,
            maximized: true,
            previousBounds: w.previousBounds ?? {
              x: w.x,
              y: w.y,
              width: w.width,
              height: w.height,
            },
            isSnapped: false,
            snapPosition: "maximized",
          };
        }
        // Snap left or right
        const halfW = Math.floor(containerWidth / 2);
        const snapX = position === "left" ? 0 : halfW;
        return {
          ...w,
          previousBounds: w.previousBounds ?? {
            x: w.x,
            y: w.y,
            width: w.width,
            height: w.height,
          },
          x: snapX,
          y: 0,
          width: halfW,
          height: containerHeight,
          isSnapped: true,
          snapPosition: position,
          maximized: false,
        };
      }),
    })),

  bringToFront: (id) =>
    set((s) => {
      const newZ = s.highestZ + 1;
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, zIndex: newZ } : w
        ),
        highestZ: newZ,
      };
    }),

  closeAll: () => set({ windows: [], focusedWindow: null }),
}));
