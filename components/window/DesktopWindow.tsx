"use client";

import { memo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { WindowInstance } from "@/types/window";
import { useAppStore } from "@/lib/store";
import WindowHeader from "./WindowHeader";
import WindowBody from "./WindowBody";

const r = tokens.radius;
const dur = tokens.duration;

interface DesktopWindowProps {
  window: WindowInstance;
}

function DesktopWindowInner({ window: win }: DesktopWindowProps) {
  const focusWindow = useAppStore((s) => s.focusWindow);
  const closeWindow = useAppStore((s) => s.closeWindow);
  const minimizeWindow = useAppStore((s) => s.minimizeWindow);
  const maximizeWindow = useAppStore((s) => s.maximizeWindow);
  const moveWindow = useAppStore((s) => s.moveWindow);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      focusWindow(win.id);
      dragOffset.current = {
        x: e.clientX - win.x,
        y: e.clientY - win.y,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = moveEvent.clientX - dragOffset.current.x;
        const newY = moveEvent.clientY - dragOffset.current.y;
        moveWindow(win.id, newX, newY);
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [win.id, win.x, win.y, focusWindow, moveWindow]
  );

  const handleFocus = useCallback(() => {
    focusWindow(win.id);
  }, [win.id, focusWindow]);

  const handleClose = useCallback(() => {
    closeWindow(win.id);
  }, [win.id, closeWindow]);

  const handleMinimize = useCallback(() => {
    minimizeWindow(win.id);
  }, [win.id, minimizeWindow]);

  const handleMaximize = useCallback(() => {
    maximizeWindow(win.id);
  }, [win.id, maximizeWindow]);

  if (win.minimized) return null;

  const style: React.CSSProperties = win.maximized
    ? { inset: 0, width: "100%", height: "100%" }
    : { left: win.x, top: win.y, width: win.width, height: win.height };

  return (
    <motion.div
      className="absolute flex flex-col overflow-hidden border border-jarvis-red/10 bg-jarvis-surface/65 backdrop-blur-[20px]"
      style={{
        ...style,
        borderRadius: win.maximized ? 0 : r.window,
        zIndex: win.zIndex,
        boxShadow: win.focused
          ? `${tokens.glow.medium}, ${tokens.shadow.large}`
          : tokens.shadow.medium,
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: dur.medium / 1000, ease: "easeOut" }}
      onMouseDown={handleFocus}
    >
      <WindowHeader
        title={win.title}
        icon={win.icon}
        focused={win.focused}
        closable={win.closable}
        minimized={win.minimized}
        maximized={win.maximized}
        draggable={win.draggable}
        onDragStart={handleDragStart}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
      />

      <WindowBody focused={win.focused}>
        <div className="h-full">
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-xs text-jarvis-text-muted">
              Module content will load here
            </p>
          </div>
        </div>
      </WindowBody>

      {win.focused && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.small / 1000 }}
          style={{
            border: "1px solid rgba(229,0,0,0.08)",
          }}
        />
      )}
    </motion.div>
  );
}

const DesktopWindow = memo(DesktopWindowInner);
export default DesktopWindow;
