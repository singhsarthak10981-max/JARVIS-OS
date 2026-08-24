"use client";

import { useEffect, useCallback, useState } from "react";
import { useAppStore } from "@/lib/store";
import Sidebar from "./sidebar";
import TopHUD from "./top-hud";
import WindowManager from "./window/WindowManager";
import Dock from "./dock/Dock";
import WallpaperRenderer from "./wallpaper/WallpaperRenderer";
import DesktopGrid from "./desktop/DesktopGrid";
import TacticalArc from "./hud/TacticalArc";
import ContextMenu from "./context-menu/ContextMenu";
import type { ContextMenuItem } from "./context-menu/ContextMenu";
import { getModule } from "@/lib/modules";
import { generateWorkspaceId } from "@/lib/workspaces";
import type { ModuleId } from "@/lib/modules";

const MODULE_WINDOW_DEFAULTS: Record<
  ModuleId,
  { width: number; height: number; title: string; icon: string }
> = {
  "command-center": { width: 1000, height: 680, title: "Command Center", icon: "◆" },
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
  const restoreSession = useAppStore((s) => s.restoreSession);
  const loadDesktopState = useAppStore((s) => s.loadDesktopState);
  const saveDesktopState = useAppStore((s) => s.saveDesktopState);
  const addDesktopShortcut = useAppStore((s) => s.addDesktopShortcut);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const workspaces = useAppStore((s) => s.workspaces);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (restoreSession) loadDesktopState();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => saveDesktopState(), 30000);
    return () => clearInterval(interval);
  }, [saveDesktopState]);

  useEffect(() => {
    if (windows.length === 0) return;
    saveDesktopState();
  }, [windows]);

  const openModuleWindow = useCallback(
    (moduleId: ModuleId) => {
      const existing = windows.find((w) => w.moduleId === moduleId);
      if (existing) {
        if (existing.minimized) useAppStore.getState().restoreWindow(existing.id);
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
    if (windows.length === 0) openModuleWindow("command-center");
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key >= "0" && e.key <= "6") {
        e.preventDefault();
        const modules: ModuleId[] = ["command-center", "dj", "producer", "bar", "business", "settings"];
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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleContextMenuAction = useCallback(
    (id: string) => {
      switch (id) {
        case "add-shortcut": {
          const modules: ModuleId[] = ["command-center", "dj", "producer", "bar", "business", "settings"];
          const existingShortcuts = useAppStore.getState().desktopShortcuts;
          const usedModules = existingShortcuts.map((s) => s.moduleId);
          const availableModule = modules.find((m) => !usedModules.includes(m));
          if (availableModule) {
            const gridX = (existingShortcuts.length % 4) * 100 + 40;
            const gridY = Math.floor(existingShortcuts.length / 4) * 100 + 40;
            addDesktopShortcut({ id: `shortcut-${Date.now()}`, moduleId: availableModule, position: { x: gridX, y: gridY } });
          }
          break;
        }
        case "add-workspace":
          addWorkspace({ id: generateWorkspaceId(), name: `Workspace ${workspaces.length + 1}`, icon: "◇", windowIds: [] });
          break;
        case "refresh":
          window.location.reload();
          break;
        case "clear-session":
          localStorage.removeItem("jarvis-desktop-state");
          window.location.reload();
          break;
      }
    },
    [addDesktopShortcut, addWorkspace, workspaces.length]
  );

  const contextMenuItems: ContextMenuItem[] = [
    { id: "add-shortcut", label: "Add Desktop Shortcut", icon: "＋" },
    { id: "add-workspace", label: "New Workspace", icon: "◇" },
    { id: "separator-1", label: "", separator: true },
    { id: "refresh", label: "Refresh", icon: "↻", shortcut: "F5" },
    { id: "clear-session", label: "Clear Session", icon: "✕", destructive: true },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
      <WallpaperRenderer />

      <Sidebar
        activeModule={active}
        onModuleChange={(id) => {
          navigate(id);
          openModuleWindow(id);
        }}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <TopHUD activeModule={active} />

        <main className="relative flex-1 overflow-hidden" onContextMenu={handleContextMenu}>
          <DesktopGrid />
          <TacticalArc />
          <div className="relative z-10 h-full w-full">
            <WindowManager />
          </div>
        </main>
      </div>

      <Dock onModuleOpen={openModuleWindow} />

      {contextMenu && (
        <ContextMenu items={contextMenuItems} position={contextMenu} onClose={() => setContextMenu(null)} onItemSelect={handleContextMenuAction} />
      )}
    </div>
  );
}
