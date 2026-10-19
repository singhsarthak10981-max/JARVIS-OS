import { getModule, type ModuleId } from "@/lib/modules";
import { useAppStore } from "@/lib/store";

export const MODULE_WINDOW_DEFAULTS: Record<
  ModuleId,
  { width: number; height: number; title: string }
> = {
  "command-center": { width: 1000, height: 680, title: "Command Center" },
  dj: { width: 900, height: 600, title: "DJ" },
  producer: { width: 900, height: 600, title: "Producer" },
  bar: { width: 800, height: 550, title: "Bar" },
  business: { width: 850, height: 600, title: "Business" },
  settings: { width: 760, height: 620, title: "Settings" },
};

/**
 * Opens a module in a desktop window, focusing the existing instance when one
 * is already mounted. Shared by the dock, sidebar, command palette and the
 * JARVIS action layer so every entry point behaves identically.
 */
export function openModuleWindow(moduleId: ModuleId): void {
  const store = useAppStore.getState();
  store.navigate(moduleId);

  const existing = store.windows.find((w) => w.moduleId === moduleId);
  if (existing) {
    if (existing.minimized) store.restoreWindow(existing.id);
    store.focusWindow(existing.id);
    return;
  }

  const defaults = MODULE_WINDOW_DEFAULTS[moduleId];
  const mod = getModule(moduleId);
  const offset = store.windows.length * 28;

  store.openWindow({
    id: `window-${moduleId}-${Date.now()}`,
    moduleId,
    title: defaults.title,
    icon: mod?.icon ?? "◇",
    x: Math.min(120 + offset, Math.max(0, window.innerWidth - defaults.width - 40)),
    y: Math.min(80 + offset, Math.max(0, window.innerHeight - defaults.height - 140)),
    width: defaults.width,
    height: defaults.height,
    minWidth: 400,
    minHeight: 300,
    minimized: false,
    maximized: false,
    resizable: true,
    closable: true,
    draggable: true,
  });

  store.logActivity(`Opened ${defaults.title}`, "info");
}

export function closeModuleWindow(moduleId: ModuleId): boolean {
  const store = useAppStore.getState();
  const matches = store.windows.filter((w) => w.moduleId === moduleId);
  if (matches.length === 0) return false;
  for (const win of matches) {
    store.closeWindow(win.id);
  }
  store.logActivity(
    `Closed ${getModule(moduleId)?.label ?? moduleId}`,
    "info"
  );
  return true;
}

export function hasModuleWindow(moduleId: ModuleId): boolean {
  return useAppStore.getState().windows.some((w) => w.moduleId === moduleId);
}
