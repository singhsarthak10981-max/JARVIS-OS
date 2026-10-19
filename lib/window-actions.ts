import { getModule, type ModuleId } from "@/lib/modules";
import { useAppStore } from "@/lib/store";

export const MODULE_WINDOW_DEFAULTS: Record<
  ModuleId,
  { width: number; height: number; title: string }
> = {
  "command-center": { width: 1120, height: 800, title: "Command Center" },
  dj: { width: 1180, height: 740, title: "DJ Workspace" },
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

  // Fit the window to the *desktop pane*, which is the coordinate space window
  // bounds live in (it excludes the sidebar and HUD). Sizes used to be fixed
  // pixels, so on a 1366x768 laptop — or at 125% Windows display scaling —
  // windows opened taller than the usable area and their content was cut off.
  const pane = document.querySelector("[data-desktop-pane]");
  const paneRect = pane?.getBoundingClientRect();
  const paneWidth = paneRect?.width ?? window.innerWidth - 240;
  const paneHeight = paneRect?.height ?? window.innerHeight - 72;

  const MARGIN = 20;
  const DOCK_SPACE = 84; // matches DOCK_SAFE_AREA reserved by WindowManager
  const availableWidth = Math.max(400, paneWidth - MARGIN * 2);
  const availableHeight = Math.max(300, paneHeight - DOCK_SPACE - MARGIN);
  const width = Math.min(defaults.width, availableWidth);
  const height = Math.min(defaults.height, availableHeight);

  const maxX = Math.max(0, paneWidth - width - MARGIN);
  const maxY = Math.max(0, paneHeight - height - DOCK_SPACE);
  const x = Math.min(MARGIN + offset, maxX);
  const y = Math.min(MARGIN + offset, maxY);

  store.openWindow({
    id: `window-${moduleId}-${Date.now()}`,
    moduleId,
    title: defaults.title,
    icon: mod?.icon ?? "◇",
    x,
    y,
    width,
    height,
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
