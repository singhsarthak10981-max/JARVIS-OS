"use client";

import type { CommandItem } from "@/components/command-palette";
import { useAppStore } from "@/lib/store";
import { MODULES, type ModuleId } from "@/lib/modules";
import type { WindowInstance } from "@/types/window";

const MODULE_WINDOW_DEFAULTS: Record<
  ModuleId,
  { width: number; height: number; title: string }
> = {
  "command-center": { width: 1000, height: 680, title: "Command Center" },
  dj: { width: 900, height: 600, title: "DJ" },
  producer: { width: 900, height: 600, title: "Producer" },
  bar: { width: 800, height: 550, title: "Bar" },
  business: { width: 850, height: 600, title: "Business" },
  settings: { width: 600, height: 450, title: "Settings" },
};

function openModuleAsWindow(moduleId: ModuleId) {
  const store = useAppStore.getState();
  const existing = store.windows.find((w) => w.moduleId === moduleId);
  if (existing) {
    store.focusWindow(existing.id);
    return;
  }

  const defaults = MODULE_WINDOW_DEFAULTS[moduleId];
  const mod = MODULES.find((m) => m.id === moduleId);

  const newWindow: Omit<WindowInstance, "zIndex" | "focused"> = {
    id: `window-${moduleId}-${Date.now()}`,
    moduleId,
    title: defaults.title,
    icon: mod?.icon ?? "◇",
    x: 120 + store.windows.length * 30,
    y: 80 + store.windows.length * 30,
    width: defaults.width,
    height: defaults.height,
    minWidth: 400,
    minHeight: 300,
    minimized: false,
    maximized: false,
    resizable: true,
    closable: true,
    draggable: true,
  };

  store.navigate(moduleId);
  store.openWindow(newWindow);
}

export function createDefaultCommands(): CommandItem[] {
  const navCommands: CommandItem[] = MODULES.map((mod) => ({
    id: `nav-${mod.id}`,
    label: mod.label,
    description: mod.description,
    icon: mod.icon,
    shortcut: mod.shortcut,
    section: "Navigation",
    action: () => openModuleAsWindow(mod.id),
  }));

  const systemCommands: CommandItem[] = [
    {
      id: "threat-assessment",
      label: "Threat Assessment",
      description: "Scan for active threat vectors",
      icon: "⚠",
      section: "Diagnostics",
      action: () => useAppStore.getState().navigate("command-center"),
    },
    {
      id: "memory-analysis",
      label: "Memory Analysis",
      description: "Review memory allocation and usage",
      icon: "⊞",
      section: "Diagnostics",
      action: () => useAppStore.getState().navigate("command-center"),
    },
    {
      id: "reboot-neural",
      label: "Reboot Neural Core",
      description: "Restart neural processing subsystem",
      icon: "↺",
      section: "System",
      action: () => useAppStore.getState().navigate("command-center"),
    },
    {
      id: "clear-cache",
      label: "Clear Cache",
      description: "Purge temporary data buffers",
      icon: "⊘",
      section: "System",
      action: () => useAppStore.getState().navigate("command-center"),
    },
    {
      id: "export-logs",
      label: "Export Logs",
      description: "Download system activity logs",
      icon: "↓",
      section: "System",
      action: () => useAppStore.getState().navigate("command-center"),
    },
    {
      id: "toggle-scanlines",
      label: "Toggle Scan Lines",
      description: "Show or hide the overlay scan lines",
      icon: "≡",
      section: "Appearance",
      action: () => {
        const store = useAppStore.getState();
        store.updateSettings({ scanlines: !store.settings.scanlines });
      },
    },
    {
      id: "change-theme",
      label: "Change Theme",
      description: "Switch between visual themes",
      icon: "◐",
      section: "Appearance",
      action: () => {},
    },
  ];

  return [...navCommands, ...systemCommands];
}
