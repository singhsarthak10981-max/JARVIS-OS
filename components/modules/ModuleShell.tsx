"use client";

import { memo } from "react";
import type { ModuleId } from "@/lib/modules";

interface ModuleShellProps {
  moduleId: ModuleId;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function ModuleShell({ moduleId, title, description, children }: ModuleShellProps) {
  return (
    <section
      data-module={moduleId}
      className="flex h-full min-h-0 flex-col bg-jarvis-bg-secondary/35 text-jarvis-text"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-jarvis-red/10 px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-jarvis-red/70">
            {moduleId}
          </div>
          <h2 className="mt-1 text-sm font-semibold tracking-wide">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-jarvis-text-muted">{description}</p>
          )}
        </div>
        <div className="h-2 w-2 rounded-full bg-jarvis-red shadow-[0_0_12px_rgba(229,0,0,0.7)]" />
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
    </section>
  );
}

export default memo(ModuleShell);
