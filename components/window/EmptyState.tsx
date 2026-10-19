"use client";

import { usePlatform } from "@/lib/use-platform";
import { formatShortcut } from "@/lib/platform";

export default function EmptyState() {
  const platform = usePlatform();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-jarvis-red/20 bg-jarvis-red/5">
          <span className="text-[20px] text-jarvis-red">◆</span>
        </div>

        <div>
          <h2 className="text-[15px] font-light tracking-[0.16em] text-jarvis-text-primary uppercase">
            JARVIS Desktop
          </h2>
          <p className="mt-1.5 text-[11.5px] text-jarvis-text-muted">
            No applications running. Open a workspace from the dock or sidebar.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] tracking-wider text-jarvis-text-disabled">
          <span>Press</span>
          <kbd className="rounded border border-white/10 bg-jarvis-surface px-1.5 py-0.5 font-mono text-[10px] text-jarvis-text-secondary">
            {formatShortcut("⌘K", platform)}
          </kbd>
          <span>to open Command Palette</span>
        </div>
      </div>
    </div>
  );
}
