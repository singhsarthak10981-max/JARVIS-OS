import { create } from "zustand";
import type { ModuleId } from "./modules";

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
}));
