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
import ReticleCursor from "./hud/ReticleCursor";
import ContextMenu from "./context-menu/ContextMenu";
import type { ContextMenuItem } from "./context-menu/ContextMenu";
import { generateWorkspaceId } from "@/lib/workspaces";
import type { ModuleId } from "@/lib/modules";
import { openModuleWindow } from "@/lib/window-actions";
import { subscribeToPersistence } from "@/lib/desktop-snapshot";

export default function Desktop() {
  const active = useAppStore((s) => s.activeModule);
  const navigate = useAppStore((s) => s.navigate);
  const restoreSession = useAppStore((s) => s.restoreSession);
  const loadDesktopState = useAppStore((s) => s.loadDesktopState);
  const saveDesktopStateDebounced = useAppStore((s) => s.saveDesktopStateDebounced);
  const saveDesktopState = useAppStore((s) => s.saveDesktopState);
  const addDesktopShortcut = useAppStore((s) => s.addDesktopShortcut);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const workspaces = useAppStore((s) => s.workspaces);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (restoreSession) loadDesktopState();
  }, [restoreSession, loadDesktopState]);

  // Persist desktop changes through a store subscription rather than a React
  // effect. An effect keyed on `windows` re-rendered the whole desktop chrome
  // on every drag frame and wrote to localStorage each time; a subscription
  // sees the same changes without any component re-render.
  //
  // Every persisted slice is observed here — not just windows and workspaces —
  // because a change to wallpaper, pinned modules, workspaces or desktop
  // shortcuts would otherwise only reach storage when some *other* change
  // happened to trigger a save.
  useEffect(() => {
    return subscribeToPersistence(useAppStore, saveDesktopStateDebounced);
  }, [saveDesktopStateDebounced]);

  // Write the live state synchronously when the page is hidden or unloaded.
  // `saveDesktopState` supersedes any queued debounced snapshot, so a drag or
  // settings change made moments before closing is never lost.
  useEffect(() => {
    const persistNow = () => {
      if (document.visibilityState === "hidden") saveDesktopState();
    };
    const persistOnHide = () => saveDesktopState();

    window.addEventListener("pagehide", persistOnHide);
    document.addEventListener("visibilitychange", persistNow);
    return () => {
      window.removeEventListener("pagehide", persistOnHide);
      document.removeEventListener("visibilitychange", persistNow);
    };
  }, [saveDesktopState]);

  useEffect(() => {
    // Runs after session restore; read live state rather than a stale render.
    if (useAppStore.getState().windows.length === 0) {
      openModuleWindow("command-center");
    }
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
  }, [navigate]);

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
    <div className="relative flex h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
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
      <ReticleCursor />
    </div>
  );
}
