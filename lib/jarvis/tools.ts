import type { ModuleId } from "./modules";

export type JarvisToolName = "open_module";

export interface JarvisToolCall {
  name: JarvisToolName;
  args: Record<string, unknown>;
}

export interface JarvisToolResult {
  ok: boolean;
  message: string;
  action?: JarvisToolCall;
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

export function resolveModuleTarget(value: string): ModuleId | null {
  const normalized = value.trim().toLowerCase();
  if (MODULE_ALIASES[normalized]) return MODULE_ALIASES[normalized];

  const alias = Object.keys(MODULE_ALIASES).find((candidate) =>
    normalized.includes(candidate),
  );

  return alias ? MODULE_ALIASES[alias] : null;
}

export function buildToolCall(
  intent: string,
  query: string,
): JarvisToolCall | null {
  if (intent !== "navigation") return null;

  const target = resolveModuleTarget(query);
  if (!target) return null;

  return {
    name: "open_module",
    args: { moduleId: target },
  };
}

export function executeTool(
  call: JarvisToolCall,
  navigate: (id: ModuleId) => void,
): JarvisToolResult {
  if (call.name !== "open_module") {
    return { ok: false, message: "Unknown J.A.R.V.I.S. tool." };
  }

  const moduleId = call.args.moduleId;
  if (typeof moduleId !== "string") {
    return { ok: false, message: "No valid module was supplied." };
  }

  const target = resolveModuleTarget(moduleId);
  if (!target) {
    return { ok: false, message: `I couldn't identify the module \"${moduleId}\".` };
  }

  navigate(target);

  const label = target === "command-center"
    ? "Command Center"
    : target.charAt(0).toUpperCase() + target.slice(1);

  return {
    ok: true,
    message: `Opening ${label}.`,
    action: call,
  };
}
