export type ModuleId =
  | "command-center"
  | "dj"
  | "producer"
  | "bar"
  | "business"
  | "settings";

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
  section: "core" | "creative" | "business" | "system";
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "command-center",
    label: "Command Center",
    description: "Main dashboard and system overview",
    icon: "◆",
    shortcut: "⌘+0",
    section: "core",
  },
  {
    id: "dj",
    label: "DJ",
    description: "Live mixing and deck control",
    icon: "♫",
    shortcut: "⌘+1",
    section: "creative",
  },
  {
    id: "producer",
    label: "Producer",
    description: "Beat making and track production",
    icon: "♩",
    shortcut: "⌘+2",
    section: "creative",
  },
  {
    id: "bar",
    label: "Bar",
    description: "Session analytics and performance metrics",
    icon: "▥",
    shortcut: "⌘+3",
    section: "creative",
  },
  {
    id: "business",
    label: "Business",
    description: "Revenue, bookings, and contracts",
    icon: "▣",
    shortcut: "⌘+4",
    section: "business",
  },
  {
    id: "settings",
    label: "Settings",
    description: "System configuration and preferences",
    icon: "⚙",
    shortcut: "⌘+,",
    section: "system",
  },
];

export function getModule(id: ModuleId): ModuleDefinition | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getModulesBySection(
  section: ModuleDefinition["section"]
): ModuleDefinition[] {
  return MODULES.filter((m) => m.section === section);
}
