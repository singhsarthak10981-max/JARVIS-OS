import { create } from "zustand";
import type { ModuleId } from "./modules";
import type { WindowInstance } from "@/types/window";

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

  // Windows
  windows: WindowInstance[];
  focusedWindow: string | null;
  highestZ: number;
  openWindow: (win: Omit<WindowInstance, "zIndex" | "focused">) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
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
      windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),

  resizeWindow: (id, width, height) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              width: Math.max(w.minWidth, width),
              height: Math.max(w.minHeight, height),
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
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, maximized: true } : w
      ),
    })),

  restoreWindow: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, maximized: false } : w
      ),
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
