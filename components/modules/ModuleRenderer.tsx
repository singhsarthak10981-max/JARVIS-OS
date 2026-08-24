"use client";

import type { ModuleId } from "@/lib/modules";
import ModuleShell from "./ModuleShell";
import CommandCenterSurface from "../command-center-surface";

function Placeholder({
  moduleId,
  title,
  description,
}: {
  moduleId: ModuleId;
  title: string;
  description: string;
}) {
  return (
    <ModuleShell moduleId={moduleId} title={title} description={description}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-jarvis-text-muted">Runtime</div>
          <div className="mt-2 text-sm text-jarvis-text">Module mounted successfully</div>
        </div>
        <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-jarvis-text-muted">Status</div>
          <div className="mt-2 text-sm text-jarvis-red">ONLINE</div>
        </div>
      </div>
    </ModuleShell>
  );
}

export default function ModuleRenderer({ moduleId }: { moduleId: ModuleId }) {
  switch (moduleId) {
    case "command-center":
      return <CommandCenterSurface />;
    case "producer":
      return <Placeholder moduleId="producer" title="Producer" description="Production workspace — beat business arrives here next." />;
    case "dj":
      return <Placeholder moduleId="dj" title="DJ" description="DJ workflow and performance operations." />;
    case "bar":
      return <Placeholder moduleId="bar" title="Bar" description="Bar operations and performance metrics." />;
    case "business":
      return <Placeholder moduleId="business" title="Business" description="Revenue, opportunities, and business operations." />;
    case "settings":
      return <Placeholder moduleId="settings" title="Settings" description="JARVIS system configuration." />;
    default:
      return null;
  }
}
