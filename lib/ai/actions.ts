"use client";

import { getModule } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";
import {
  closeModuleWindow,
  hasModuleWindow,
  openModuleWindow,
} from "@/lib/window-actions";
import { desktopPersistence } from "@/services/storage/DesktopPersistence";
import { nextTheme, type JarvisAction } from "./intents";
import {
  capabilityForAction,
  capabilityResult,
  type CapabilityResult,
} from "./capabilities";
import { THEMES, getProviderMeta } from "./providers";
import { addMemory, clearMemories, loadConversation, loadMemories } from "./memory";
import { cancelAllTimers, startTimer } from "./timers";
import { stopSpeaking } from "./voice";

/**
 * Result of one deterministic action.
 *
 * It is now a `CapabilityResult`: `ok`/`message` are unchanged for existing
 * callers, plus a stable capability id and an explicit status. `denied` and
 * `cancelled` exist for future capabilities that need consent or long-running
 * work; the desktop actions here only produce success, failure or unsupported.
 */
export type ActionResult = CapabilityResult;

interface ExecuteOptions {
  ownerName: string;
  speak: (text: string) => void;
}

interface RawActionResult {
  ok: boolean;
  message: string;
}

function labelForPreset(preset: string): string {
  return preset
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function executeJarvisAction(
  action: JarvisAction,
  options: ExecuteOptions
): ActionResult {
  const capability = capabilityForAction(action);
  const result = runAction(action, options);

  // An action the registry does not describe is reported as unsupported
  // rather than being attributed to a capability it does not belong to.
  if (!capability) {
    // No guessed attribution: an action the registry does not describe is
    // reported as unsupported and produces no capability event.
    return capabilityResult(
      null,
      "unsupported",
      "That capability isn't registered in this build."
    );
  }

  return capabilityResult(
    capability.id,
    result.ok ? "success" : "failed",
    result.message
  );
}

function runAction(
  action: JarvisAction,
  options: ExecuteOptions
): RawActionResult {
  const store = useAppStore.getState();
  const owner = options.ownerName || "sir";

  switch (action.type) {
    case "open-module": {
      openModuleWindow(action.moduleId);
      const label = getModule(action.moduleId)?.label ?? action.moduleId;

      if (action.view) {
        store.setDjView(action.view);
      }

      if (action.launch === "rekordbox") {
        // The DJ launchpad attempts the launch through the local bridge and
        // reports the real outcome. No bridge means no launch — never faked.
        store.requestDjLaunch();
        return {
          ok: true,
          message: `${label} online, ${owner}. Requesting Rekordbox through the local bridge.`,
        };
      }

      return { ok: true, message: `${label} online, ${owner}.` };
    }

    case "set-dj-view": {
      store.setDjView(action.view);
      return { ok: true, message: `DJ view set to ${action.view}.` };
    }

    case "close-module": {
      const label = getModule(action.moduleId)?.label ?? action.moduleId;
      if (!hasModuleWindow(action.moduleId)) {
        return {
          ok: false,
          message: `The ${label} window isn't open, ${owner}.`,
        };
      }
      closeModuleWindow(action.moduleId);
      return { ok: true, message: `${label} closed.` };
    }

    case "close-all-windows": {
      const count = store.windows.length;
      store.closeAll();
      store.logActivity(`Closed all windows (${count})`, "info");
      return {
        ok: true,
        message:
          count === 0
            ? "There were no windows open."
            : `Closed ${count} window${count === 1 ? "" : "s"}.`,
      };
    }

    case "set-theme": {
      const themeId =
        action.theme === "next"
          ? nextTheme(store.settings.theme)
          : action.theme;
      store.updateSettings({ theme: themeId });
      const label = THEMES.find((t) => t.id === themeId)?.label ?? themeId;
      store.logActivity(`Theme set to ${label}`, "success");
      return { ok: true, message: `${label} theme engaged.` };
    }

    case "set-wallpaper": {
      const presets = tokens.wallpaper.presets as Record<
        string,
        { primary: string; secondary: string; accent: string; gradient: string }
      >;
      const preset = presets[action.preset] ?? presets["tactical-red"];
      store.setWallpaper({
        type: action.preset === "animated-gradient" ? "animated" : "gradient",
        preset: action.preset,
        primaryColor: preset.primary,
        secondaryColor: preset.secondary,
        accentColor: preset.accent,
      });
      store.logActivity(
        `Wallpaper set to ${labelForPreset(action.preset)}`,
        "success"
      );
      return {
        ok: true,
        message: `Wallpaper set to ${labelForPreset(action.preset)}.`,
      };
    }

    case "toggle-setting": {
      const current = Boolean(store.settings[action.setting]);
      const value = action.value ?? !current;
      store.updateSettings({ [action.setting]: value });
      const names: Record<
        "scanlines" | "particles" | "soundEnabled" | "voiceEnabled",
        string
      > = {
        scanlines: "Scan lines",
        particles: "Ambient particles",
        soundEnabled: "Interface sound",
        voiceEnabled: "Voice output",
      };
      store.logActivity(
        `${names[action.setting]} ${value ? "enabled" : "disabled"}`,
        "info"
      );
      return {
        ok: true,
        message: `${names[action.setting]} ${value ? "enabled" : "disabled"}.`,
      };
    }

    case "start-timer": {
      const timer = startTimer(action.seconds, action.label, () => {
        const state = useAppStore.getState();
        state.addNotification({
          title: "Timer complete",
          message: action.label,
          type: "success",
        });
        state.logActivity(`Timer complete: ${action.label}`, "success");
        if (useAppStore.getState().settings.voiceEnabled) {
          state.setAiState("speaking");
          options.speak(`Timer complete, ${owner}. ${action.label}.`);
          setTimeout(() => {
            if (useAppStore.getState().aiState === "speaking") {
              useAppStore.getState().setAiState("idle");
            }
          }, 4000);
        }
      });
      store.logActivity(`Timer armed: ${action.label} (${timer.duration}s)`, "info");
      return {
        ok: true,
        message: `Timer armed for ${action.label}.`,
      };
    }

    case "cancel-timers": {
      const count = cancelAllTimers();
      store.logActivity(`Cancelled ${count} timer(s)`, "info");
      return {
        ok: true,
        message:
          count === 0
            ? "There were no active timers."
            : `Cancelled ${count} timer${count === 1 ? "" : "s"}.`,
      };
    }

    case "remember": {
      addMemory(action.fact);
      store.logActivity("Memory updated", "success");
      return { ok: true, message: "Memory bank updated." };
    }

    case "forget-memory": {
      clearMemories();
      store.logActivity("Memory bank cleared", "warning");
      return { ok: true, message: "Memory bank wiped." };
    }

    case "reboot": {
      stopSpeaking();
      store.logActivity("Reboot requested", "warning");
      setTimeout(() => {
        useAppStore.getState().reboot();
      }, 300);
      return { ok: true, message: "Rebooting now." };
    }

    case "clear-session": {
      desktopPersistence.clear();
      try {
        window.localStorage.removeItem("jarvis-desktop-state");
      } catch {
        // ignore
      }
      stopSpeaking();
      setTimeout(() => window.location.reload(), 350);
      return { ok: true, message: "Session cleared. Reloading." };
    }

    case "open-palette": {
      store.openPalette();
      return { ok: true, message: "Command palette open." };
    }

    case "export-logs": {
      const settings = store.settings;
      downloadJson(`jarvis-diagnostics-${Date.now()}.json`, {
        system: "JARVIS OS",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        activity: store.activity,
        windows: store.windows.map((w) => ({
          module: w.moduleId,
          title: w.title,
          bounds: { x: w.x, y: w.y, width: w.width, height: w.height },
          minimized: w.minimized,
        })),
        memories: loadMemories(),
        conversation: loadConversation(),
        settings: {
          ownerName: settings.ownerName,
          theme: settings.theme,
          scanlines: settings.scanlines,
          particles: settings.particles,
          voiceEnabled: settings.voiceEnabled,
          aiProvider: settings.aiProvider,
          aiModel: settings.aiModel,
          // API keys are intentionally never exported.
        },
      });
      store.logActivity("Diagnostics exported", "success");
      return { ok: true, message: "Diagnostics exported." };
    }

    case "stop-speaking": {
      stopSpeaking();
      return { ok: true, message: "Standing by." };
    }

    default:
      return { ok: false, message: "I don't know how to do that yet." };
  }
}

export function providerDisplayName(
  provider: string,
  model: string
): string {
  if (provider === "local") return "local core";
  const meta = getProviderMeta(provider);
  return `${meta.label}${model ? ` · ${model}` : ""}`;
}
