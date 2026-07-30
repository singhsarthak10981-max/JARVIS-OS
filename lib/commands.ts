"use client";

import type { CommandItem } from "@/components/command-palette";
import { useAppStore } from "@/lib/store";
import { MODULES } from "@/lib/modules";

export function createDefaultCommands(): CommandItem[] {
  const navCommands: CommandItem[] = MODULES.map((mod) => ({
    id: `nav-${mod.id}`,
    label: mod.label,
    description: mod.description,
    icon: mod.icon,
    shortcut: mod.shortcut,
    section: "Navigation",
    action: () => useAppStore.getState().navigate(mod.id),
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
