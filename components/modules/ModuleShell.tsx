"use client";

import { memo } from "react";
import type { ModuleId } from "@/lib/modules";

interface ModuleShellProps {
  moduleId: ModuleId;
  title: string;
  description?: string;
  /** Hide the in-module header when the surrounding window chrome already
   *  shows the title (avoids a duplicated title stack). */
  hideHeader?: boolean;
  /** Remove inner padding so a dense surface can own its own layout. */
  flush?: boolean;
  children: React.ReactNode;
}

function ModuleShell({
  moduleId,
  title,
  description,
  hideHeader = false,
  flush = false,
  children,
}: ModuleShellProps) {
  return (
    <section
      data-module={moduleId}
      className="flex h-full min-h-0 flex-col bg-jarvis-bg-secondary/35 text-jarvis-text"
    >
      {!hideHeader && (
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="text-[9px] tracking-[0.24em] text-jarvis-red/70 uppercase">
              {moduleId}
            </div>
            <h2 className="mt-0.5 truncate text-[13px] font-medium tracking-wide text-jarvis-text-primary">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 truncate text-[10.5px] text-jarvis-text-muted">
                {description}
              </p>
            )}
          </div>
        </header>
      )}
      <div
        className={
          flush
            ? "min-h-0 flex-1 overflow-hidden"
            : "min-h-0 flex-1 overflow-auto p-4 sm:p-5"
        }
      >
        {children}
      </div>
    </section>
  );
}

export default memo(ModuleShell);
