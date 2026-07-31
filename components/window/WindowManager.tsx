"use client";

import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import DesktopWindow from "./DesktopWindow";
import EmptyState from "./EmptyState";

export default function WindowManager() {
  const windows = useAppStore((s) => s.windows);

  return (
    <div className="relative h-full w-full">
      {windows.length === 0 && <EmptyState />}

      <AnimatePresence>
        {windows.map((win) => (
          <DesktopWindow key={win.id} window={win} />
        ))}
      </AnimatePresence>
    </div>
  );
}
