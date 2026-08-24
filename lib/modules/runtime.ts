import type { ModuleId } from "@/lib/modules";

export interface ModuleRuntimeContext {
  moduleId: ModuleId;
  windowId?: string;
  workspaceId?: string;
}

export interface ModuleRuntimeDefinition {
  id: ModuleId;
  title: string;
  description: string;
  section: "core" | "creative" | "business" | "system";
}
