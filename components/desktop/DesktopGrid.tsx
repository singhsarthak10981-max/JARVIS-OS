"use client";

import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import DesktopShortcut from "./DesktopShortcut";

export default function DesktopGrid() {
  const shortcuts = useAppStore((s) => s.desktopShortcuts);

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <AnimatePresence>
        {shortcuts.map((shortcut) => (
          <DesktopShortcut
            key={shortcut.id}
            id={shortcut.id}
            moduleId={shortcut.moduleId}
            position={shortcut.position}
            label={shortcut.label}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
