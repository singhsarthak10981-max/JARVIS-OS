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
  section: "core" | "creative" | "venue" | "business" | "system";
  /**
   * What the workspace is intended to hold. Shown in the honest "not built
   * yet" shell so a placeholder never implies working features.
   */
  planned?: string[];
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
    description: "Rekordbox library, filtering and harmonic set building",
    icon: "♫",
    shortcut: "⌘+1",
    section: "creative",
  },
  {
    id: "producer",
    label: "Producer",
    description: "Production workspace — beats, vocals and artist projects",
    icon: "♩",
    shortcut: "⌘+2",
    section: "creative",
    planned: [
      "Beat and session workspace",
      "Vocal chain presets",
      "Artist and release notes",
    ],
  },
  {
    id: "bar",
    label: "Bar",
    description: "Bar operations, stock and service notes",
    icon: "▥",
    shortcut: "⌘+3",
    section: "venue",
    planned: [
      "Stock and supplier records",
      "Shift and service notes",
      "Takings summaries",
    ],
  },
  {
    id: "business",
    label: "Business",
    description: "Revenue, bookings and contracts",
    icon: "▣",
    shortcut: "⌘+4",
    section: "business",
    planned: [
      "Revenue and opportunity tracking",
      "Bookings and contracts",
      "Research notes",
    ],
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

/** Display order and labels for the navigation groups. */
export const MODULE_SECTIONS = [
  { id: "core", label: "Core" },
  { id: "creative", label: "Studio" },
  { id: "venue", label: "Venue" },
  { id: "business", label: "Business" },
  { id: "system", label: "System" },
] as const;

export function getModulesBySection(
  section: ModuleDefinition["section"]
): ModuleDefinition[] {
  return MODULES.filter((m) => m.section === section);
}
