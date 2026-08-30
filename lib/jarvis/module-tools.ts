import type { ModuleId } from "./modules";
import { getModule } from "./modules";
import type { WindowInstance } from "@/types/window";

export type JarvisModuleToolName = "open_module";

export interface JarvisModuleToolCall {
  name: JarvisModuleToolName;
  args: Record<string, unknown>;
}

export interface JarvisModuleToolResult {
  ok: boolean;
  message: string;
  action?: JarvisModuleToolCall;
}

const MODULE_ALIASES: Record<string, ModuleId> = {
  "command center": "command-center",
  command: "command-center",
  home: "command-center",
  producer: "producer",
  production: "producer",
  dj: "dj",
  bar: "bar",
  business: "business",
  settings: "settings",
};

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

export function resolveModuleTarget(value: string): ModuleId | null {
  const normalized = value.trim().toLowerCase();
  if (MODULE_ALIASES[normalized]) return MODULE_ALIASES[normalized];

  const alias = Object.keys(MODULE_ALIASES).find((candidate) =>
    normalized.includes(candidate),
  );

  return alias ? MODULE_ALIASES[alias] : null;
}

export function buildModuleToolCall(
  intent: string,
  query: string,
): JarvisModuleToolCall | null {
  if (intent !== "navigation") return null;

  const target = resolveModuleTarget(query);
  if (!target) return null;

  return {
    name: "open_module",
    args: { moduleId: target },
  };
}

export function executeModuleTool(
  call: JarvisModuleToolCall,
  actions: {
    navigate: (id: ModuleId) => void;
    openWindow: (
      window: Omit<
        WindowInstance,
        "zIndex" | "focused" | "previousBounds" | "isSnapped" | "snapPosition"
      >
    ) => void;
    focusWindow: (id: string) => void;
    windows: WindowInstance[];
  },
): JarvisModuleToolResult {
  if (call.name !== "open_module") {
    return { ok: false, message: "Unknown J.A.R.V.I.S. tool." };
  }

  const value = call.args.moduleId;
  if (typeof value !== "string") {
    return { ok: false, message: "No valid module was supplied." };
  }

  const target = resolveModuleTarget(value);
  if (!target) {
    return { ok: false, message: `I couldn't identify the module \"${value}\".` };
  }

  const existing = actions.windows.find((window) => window.moduleId === target);

  if (existing) {
    actions.navigate(target);
    actions.focusWindow(existing.id);
  } else {
    const defaults = MODULE_WINDOW_DEFAULTS[target];
    const module = getModule(target);
    const offset = actions.windows.length * 30;

    actions.openWindow({
      id: `window-${target}-${Date.now()}`,
      moduleId: target,
      title: defaults.title,
      icon: module?.icon ?? "◇",
      x: 120 + offset,
      y: 80 + offset,
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

    actions.navigate(target);
  }

  const label = target === "command-center"
    ? "Command Center"
    : target.charAt(0).toUpperCase() + target.slice(1);

  return {
    ok: true,
    message: `Opening ${label}.`,
    action: call,
  };
}
