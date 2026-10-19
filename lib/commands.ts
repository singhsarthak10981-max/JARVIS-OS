"use client";

import type { CommandItem } from "@/components/command-palette";
import { useAppStore } from "@/lib/store";
import { MODULES } from "@/lib/modules";
import { openModuleWindow } from "@/lib/window-actions";
import { THEMES } from "@/lib/ai/providers";
import { executeJarvisAction, type ActionResult } from "@/lib/ai/actions";
import type { JarvisAction } from "@/lib/ai/intents";
import { clearMemories } from "@/lib/ai/memory";
import { speak } from "@/lib/ai/voice";
import {
  requestClearChat,
  requestVoiceSession,
} from "@/lib/assistant-events";

function speakIfEnabled(text: string): void {
  const settings = useAppStore.getState().settings;
  if (!settings.voiceEnabled) return;
  void speak(text, {
    rate: settings.voiceRate,
    pitch: settings.voicePitch,
    voiceURI: settings.voiceURI,
  });
}

function run(action: JarvisAction): ActionResult {
  const settings = useAppStore.getState().settings;
  return executeJarvisAction(action, {
    ownerName: settings.ownerName,
    speak: speakIfEnabled,
  });
}

export function createDefaultCommands(): CommandItem[] {
  const navCommands: CommandItem[] = MODULES.map((mod) => ({
    id: `nav-${mod.id}`,
    label: mod.label,
    description: mod.description,
    icon: mod.icon,
    shortcut: mod.shortcut,
    section: "Navigation",
    action: () => openModuleWindow(mod.id),
  }));

  const assistantCommands: CommandItem[] = [
    {
      id: "summon-jarvis",
      label: "Summon JARVIS",
      description: "Open the assistant panel and issue a directive",
      icon: "◉",
      shortcut: "⌘⇧J",
      section: "JARVIS",
      action: () => useAppStore.getState().openAssistant(),
    },
    {
      id: "voice-session",
      label: "Start Voice Session",
      description: "Open the mic and speak a command",
      icon: "◇",
      section: "JARVIS",
      action: () => {
        useAppStore.getState().openAssistant();
        // Defer until the panel has mounted.
        setTimeout(requestVoiceSession, 60);
      },
    },
    {
      id: "system-report",
      label: "System Status Report",
      description: "Ask JARVIS for a full diagnostics summary",
      icon: "◈",
      section: "Diagnostics",
      action: () => useAppStore.getState().openAssistant("System status report"),
    },
    {
      id: "memory-bank",
      label: "Memory Bank",
      description: "Review what JARVIS remembers about you",
      icon: "▣",
      section: "Diagnostics",
      action: () =>
        useAppStore.getState().openAssistant("What do you remember?"),
    },
    {
      id: "clear-conversation",
      label: "Clear Conversation",
      description: "Wipe the current assistant transcript",
      icon: "⊘",
      section: "JARVIS",
      action: () => {
        requestClearChat();
        useAppStore.getState().openAssistant();
      },
    },
  ];

  const appearanceCommands: CommandItem[] = [
    {
      id: "cycle-theme",
      label: "Cycle Theme",
      description: "Rotate through Tactical Red, Arc Reactor and Stealth",
      icon: "◐",
      section: "Appearance",
      action: () => run({ type: "set-theme", theme: "next" }),
    },
    ...THEMES.map<CommandItem>((theme) => ({
      id: `theme-${theme.id}`,
      label: `Theme: ${theme.label}`,
      description: theme.description,
      icon: "◇",
      section: "Appearance",
      action: () => run({ type: "set-theme", theme: theme.id }),
    })),
    {
      id: "cycle-wallpaper",
      label: "Cycle Wallpaper",
      description: "Move to the next desktop wallpaper preset",
      icon: "▤",
      section: "Appearance",
      action: () => {
        const presets = [
          "tactical-red",
          "midnight-blue",
          "emerald",
          "royal-purple",
          "carbon",
          "animated-gradient",
        ];
        const current = useAppStore.getState().wallpaper.preset;
        const index = presets.indexOf(current);
        run({
          type: "set-wallpaper",
          preset: presets[(index + 1) % presets.length],
        });
      },
    },
    {
      id: "toggle-scanlines",
      label: "Toggle Scan Lines",
      description: "Show or hide the overlay scan lines",
      icon: "≡",
      section: "Appearance",
      action: () =>
        run({ type: "toggle-setting", setting: "scanlines" }),
    },
    {
      id: "toggle-particles",
      label: "Toggle Ambient Particles",
      description: "Enable or disable the drifting particle layer",
      icon: "✧",
      section: "Appearance",
      action: () =>
        run({ type: "toggle-setting", setting: "particles" }),
    },
    {
      id: "toggle-voice",
      label: "Toggle Spoken Replies",
      description: "Mute or unmute JARVIS's voice",
      icon: "◊",
      section: "Appearance",
      action: () =>
        run({ type: "toggle-setting", setting: "voiceEnabled" }),
    },
    {
      id: "toggle-wake",
      label: "Toggle Wake Word",
      description: "Listen for the wake phrase in the background",
      icon: "◎",
      section: "Appearance",
      action: () => {
        const store = useAppStore.getState();
        const next = !store.settings.wakeWordEnabled;
        store.updateSettings({ wakeWordEnabled: next });
        store.addNotification({
          title: next ? "Wake word enabled" : "Wake word disabled",
          message: next
            ? `Say “${store.settings.wakePhrase || "jarvis"}” to summon JARVIS.`
            : "Background listening has stopped.",
          type: "info",
        });
      },
    },
  ];

  const systemCommands: CommandItem[] = [
    {
      id: "reboot-neural",
      label: "Reboot Neural Core",
      description: "Restart the shell and replay the boot sequence",
      icon: "↺",
      section: "System",
      action: () => run({ type: "reboot" }),
    },
    {
      id: "export-logs",
      label: "Export Diagnostics",
      description: "Download activity, windows and settings as JSON",
      icon: "↓",
      section: "System",
      action: () => run({ type: "export-logs" }),
    },
    {
      id: "clear-memory",
      label: "Clear Memory Bank",
      description: "Forget every long-term memory JARVIS holds",
      icon: "⊘",
      section: "System",
      action: () => {
        clearMemories();
        useAppStore.getState().logActivity("Memory bank cleared", "warning");
        useAppStore.getState().addNotification({
          title: "Memory cleared",
          message: "Long-term memory bank is now empty.",
          type: "warning",
        });
      },
    },
    {
      id: "open-settings",
      label: "Settings",
      description: "Intelligence, voice, interface and system configuration",
      icon: "⚙",
      shortcut: "⌘,",
      section: "System",
      action: () => openModuleWindow("settings"),
    },
  ];

  return [
    ...navCommands,
    ...assistantCommands,
    ...appearanceCommands,
    ...systemCommands,
  ];
}
