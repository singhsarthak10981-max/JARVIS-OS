"use client";

import type { ModuleId } from "@/lib/modules";
import ModuleShell from "./ModuleShell";

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
          <div className="text-[10px] uppercase tracking-[0.2em] text-jarvis-text-muted">
            Runtime
          </div>
          <div className="mt-2 text-sm text-jarvis-text">Module mounted successfully</div>
        </div>
        <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-jarvis-text-muted">
            Status
          </div>
          <div className="mt-2 text-sm text-jarvis-red">ONLINE</div>
        </div>
      </div>
    </ModuleShell>
  );
}

function CommandCenterModule() {
  return (
    <Placeholder
      moduleId="command-center"
      title="Command Center"
      description="System overview and mission control."
    />
  );
}

function ProducerModule() {
  return (
    <Placeholder
      moduleId="producer"
      title="Producer"
      description="Production workspace — beat business arrives here next."
    />
  );
}

function DjModule() {
  return (
    <Placeholder
      moduleId="dj"
      title="DJ"
      description="DJ workflow and performance operations."
    />
  );
}

function BarModule() {
  return (
    <Placeholder
      moduleId="bar"
      title="Bar"
      description="Bar operations and performance metrics."
    />
  );
}

function BusinessModule() {
  return (
    <Placeholder
      moduleId="business"
      title="Business"
      description="Revenue, opportunities, and business operations."
    />
  );
}

function SettingsModule() {
  return (
    <Placeholder
      moduleId="settings"
      title="Settings"
      description="JARVIS system configuration."
    />
  );
}

export default function ModuleRenderer({ moduleId }: { moduleId: ModuleId }) {
  switch (moduleId) {
    case "command-center":
      return <CommandCenterModule />;
    case "producer":
      return <ProducerModule />;
    case "dj":
      return <DjModule />;
    case "bar":
      return <BarModule />;
    case "business":
      return <BusinessModule />;
    case "settings":
      return <SettingsModule />;
    default:
      return null;
  }
}
