"use client";

import { useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import Sidebar from "./sidebar";
import TopHUD from "./top-hud";
import WindowManager from "./window/WindowManager";
import Dock from "./dock/Dock";
import { getModule } from "@/lib/modules";
import type { ModuleId } from "@/lib/modules";

const MODULE_WINDOW_DEFAULTS: Record<
  ModuleId,
  { width: number; height: number; title: string; icon: string }
> = {
  "command-center": {
    width: 1000,
    height: 680,
    title: "Command Center",
    icon: "◆",
  },
  dj: { width: 900, height: 600, title: "DJ", icon: "♫" },
  producer: { width: 900, height: 600, title: "Producer", icon: "♩" },
  bar: { width: 800, height: 550, title: "Bar", icon: "▥" },
  business: { width: 850, height: 600, title: "Business", icon: "▣" },
  settings: { width: 600, height: 450, title: "Settings", icon: "⚙" },
};

export default function Desktop() {
  const active = useAppStore((s) => s.activeModule);
  const navigate = useAppStore((s) => s.navigate);
  const openWindow = useAppStore((s) => s.openWindow);
  const focusWindow = useAppStore((s) => s.focusWindow);
  const windows = useAppStore((s) => s.windows);

  const openModuleWindow = useCallback(
    (moduleId: ModuleId) => {
      const existing = windows.find((w) => w.moduleId === moduleId);
      if (existing) {
        focusWindow(existing.id);
        return;
      }

      const defaults = MODULE_WINDOW_DEFAULTS[moduleId];
      const mod = getModule(moduleId);

      openWindow({
        id: `window-${moduleId}-${Date.now()}`,
        moduleId,
        title: defaults.title,
        icon: mod?.icon ?? "◇",
        x: 120 + windows.length * 30,
        y: 80 + windows.length * 30,
        width: defaults.width,
        height: defaults.height,
        minWidth: 400,
        minHeight: 300,
        minimized: false,
        maximized: false,
        resizable: true,
        closable: true,
        draggable: true,
      });
    },
    [windows, openWindow, focusWindow]
  );

  useEffect(() => {
    if (windows.length === 0) {
      openModuleWindow("command-center");
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key >= "0" && e.key <= "6") {
        e.preventDefault();
        const modules: ModuleId[] = [
          "command-center",
          "dj",
          "producer",
          "bar",
          "business",
          "settings",
        ];
        const idx = parseInt(e.key, 10);
        if (modules[idx]) {
          navigate(modules[idx]);
          openModuleWindow(modules[idx]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, openModuleWindow]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
      <Sidebar activeModule={active} onModuleChange={(id) => {
        navigate(id);
        openModuleWindow(id);
      }} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHUD activeModule={active} />

        <main className="relative flex-1 overflow-hidden">
          <WindowManager />
        </main>
      </div>

      <Dock onModuleOpen={openModuleWindow} />
    </div>
  );
}
