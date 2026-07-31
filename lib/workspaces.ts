export interface Workspace {
  id: string;
  name: string;
  icon: string;
  windowIds: string[];
  wallpaper?: string;
}

export const WORKSPACE_PRESETS: Workspace[] = [
  {
    id: "workspace-main",
    name: "Main",
    icon: "◆",
    windowIds: [],
  },
  {
    id: "workspace-production",
    name: "Production",
    icon: "♫",
    windowIds: [],
  },
  {
    id: "workspace-business",
    name: "Business",
    icon: "▣",
    windowIds: [],
  },
  {
    id: "workspace-creative",
    name: "Creative",
    icon: "★",
    windowIds: [],
  },
];

export function createWorkspace(
  id: string,
  name: string,
  icon: string
): Workspace {
  return { id, name, icon, windowIds: [] };
}

export function generateWorkspaceId(): string {
  return `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
