"use client";

import type { ModuleId } from "@/lib/modules";
import ModulePreview from "./ModulePreview";
import CommandCenterDashboard from "../command-center-dashboard";
import SettingsModule from "./SettingsModule";
import DjModule from "@/features/dj/components/DjModule";

export default function ModuleRenderer({ moduleId }: { moduleId: ModuleId }) {
  switch (moduleId) {
    case "command-center":
      return <CommandCenterDashboard />;
    case "producer":
      return <ModulePreview moduleId="producer" />;
    case "dj":
      return <DjModule />;
    case "bar":
      return <ModulePreview moduleId="bar" />;
    case "business":
      return <ModulePreview moduleId="business" />;
    case "settings":
      return <SettingsModule />;
    default:
      return null;
  }
}
