"use client";

import { useRef, useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import DesktopWindow from "./DesktopWindow";
import EmptyState from "./EmptyState";
import type { ModuleId } from "@/lib/modules";

interface WindowManagerProps {
  excludeModuleId?: ModuleId;
}

export default function WindowManager({ excludeModuleId }: WindowManagerProps) {
  const windows = useAppStore((s) => s.windows);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visibleWindows = excludeModuleId
    ? windows.filter((win) => win.moduleId !== excludeModuleId)
    : windows;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {visibleWindows.length === 0 && <EmptyState />}

      <AnimatePresence>
        {visibleWindows.map((win) => (
          <DesktopWindow
            key={win.id}
            window={win}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
