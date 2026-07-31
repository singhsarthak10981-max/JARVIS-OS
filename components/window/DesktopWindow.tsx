"use client";

import { memo, useCallback, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { WindowInstance, SnapPosition } from "@/types/window";
import { useAppStore } from "@/lib/store";
import WindowHeader from "./WindowHeader";
import WindowBody from "./WindowBody";
import ResizeHandle, { type ResizeEdge } from "./ResizeHandle";
import SnapOverlay from "./SnapOverlay";
import { snapTransition, glassTransition, getWindowStyle } from "./WindowAnimations";

const r = tokens.radius;

const SNAP_THRESHOLD = 20;

function computeSnapPosition(
  clientX: number,
  clientY: number,
  containerWidth: number,
  containerHeight: number
): SnapPosition {
  if (clientY <= SNAP_THRESHOLD) return "maximized";
  if (clientX <= SNAP_THRESHOLD) return "left";
  if (clientX >= containerWidth - SNAP_THRESHOLD) return "right";
  return null;
}

interface DesktopWindowProps {
  window: WindowInstance;
  containerWidth: number;
  containerHeight: number;
}

function DesktopWindowInner({ window: win, containerWidth, containerHeight }: DesktopWindowProps) {
  const focusWindow = useAppStore((s) => s.focusWindow);
  const closeWindow = useAppStore((s) => s.closeWindow);
  const minimizeWindow = useAppStore((s) => s.minimizeWindow);
  const maximizeWindow = useAppStore((s) => s.maximizeWindow);
  const moveWindow = useAppStore((s) => s.moveWindow);
  const setWindowBounds = useAppStore((s) => s.setWindowBounds);
  const snapWindow = useAppStore((s) => s.snapWindow);

  const dragOffset = useRef({ x: 0, y: 0 });
  const [snapPreview, setSnapPreview] = useState<SnapPosition>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── Drag handling ──────────────────────────────────────
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      focusWindow(win.id);
      dragOffset.current = {
        x: e.clientX - win.x,
        y: e.clientY - win.y,
      };
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newX = moveEvent.clientX - dragOffset.current.x;
        const newY = moveEvent.clientY - dragOffset.current.y;
        moveWindow(win.id, newX, newY);

        const snap = computeSnapPosition(
          moveEvent.clientX,
          moveEvent.clientY,
          containerWidth,
          containerHeight
        );
        setSnapPreview(snap);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        setIsDragging(false);
        const snap = computeSnapPosition(
          upEvent.clientX,
          upEvent.clientY,
          containerWidth,
          containerHeight
        );

        if (snap) {
          snapWindow(win.id, snap, containerWidth, containerHeight);
        }
        setSnapPreview(null);
      };

      document.body.style.cursor =
        win.resizable ? "grabbing" : "default";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [win.id, win.x, win.y, win.resizable, focusWindow, moveWindow, snapWindow, containerWidth, containerHeight]
  );

  // ── Resize handling ────────────────────────────────────
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, edge: ResizeEdge) => {
      e.preventDefault();
      e.stopPropagation();
      focusWindow(win.id);

      const startX = e.clientX;
      const startY = e.clientY;
      const startBounds = {
        x: win.x,
        y: win.y,
        width: win.width,
        height: win.height,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        let newX = startBounds.x;
        let newY = startBounds.y;
        let newW = startBounds.width;
        let newH = startBounds.height;

        if (edge.includes("right")) {
          newW = Math.max(win.minWidth, startBounds.width + dx);
        }
        if (edge.includes("left")) {
          newW = Math.max(win.minWidth, startBounds.width - dx);
          if (newW > win.minWidth) {
            newX = startBounds.x + dx;
          }
        }
        if (edge.includes("bottom")) {
          newH = Math.max(win.minHeight, startBounds.height + dy);
        }
        if (edge.includes("top")) {
          newH = Math.max(win.minHeight, startBounds.height - dy);
          if (newH > win.minHeight) {
            newY = startBounds.y + dy;
          }
        }

        // Clamp to container bounds
        newX = Math.max(0, Math.min(newX, containerWidth - newW));
        newY = Math.max(0, Math.min(newY, containerHeight - newH));

        setWindowBounds(win.id, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = CURSORS[edge];
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [win, focusWindow, setWindowBounds, containerWidth, containerHeight]
  );

  // ── Focus ──────────────────────────────────────────────
  const handleFocus = useCallback(() => {
    focusWindow(win.id);
  }, [win.id, focusWindow]);

  // ── Close ──────────────────────────────────────────────
  const handleClose = useCallback(() => {
    closeWindow(win.id);
  }, [win.id, closeWindow]);

  // ── Minimize ───────────────────────────────────────────
  const handleMinimize = useCallback(() => {
    minimizeWindow(win.id);
  }, [win.id, minimizeWindow]);

  // ── Maximize toggle ────────────────────────────────────
  const handleMaximize = useCallback(() => {
    maximizeWindow(win.id);
  }, [win.id, maximizeWindow]);

  if (win.minimized) return null;

  const windowStyle = getWindowStyle(win);
  const isAnimatingMaximize = win.maximized || win.isSnapped;

  return (
    <>
      <SnapOverlay
        position={snapPreview}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
      />

      <motion.div
        className="absolute flex flex-col overflow-hidden border border-jarvis-red/10 bg-jarvis-surface/65"
        style={{
          ...windowStyle,
          borderRadius: isAnimatingMaximize ? 0 : r.window,
          backdropFilter: `blur(${tokens.glass.blur})`,
          boxShadow: win.focused
            ? `${tokens.glow.medium}, ${tokens.shadow.large}`
            : tokens.shadow.medium,
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{
          opacity: 1,
          scale: 1,
          left: win.x,
          top: win.y,
          width: win.width,
          height: win.height,
          borderRadius: isAnimatingMaximize ? 0 : r.window,
        }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={isAnimatingMaximize ? snapTransition : { duration: 0.2, ease: "easeOut" }}
        onMouseDown={handleFocus}
        layout
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

        {/* Resize handles */}
        {win.resizable &&
          ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-left", "bottom-right"].map(
            (edge) => (
              <ResizeHandle
                key={edge}
                edge={edge as ResizeEdge}
                onResizeStart={handleResizeStart}
              />
            )
          )}

        {/* Focused border glow */}
        {win.focused && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              border: "1px solid rgba(229,0,0,0.08)",
            }}
          />
        )}
      </motion.div>
    </>
  );
}

const CURSORS: Record<ResizeEdge, string> = {
  top: "ns-resize",
  bottom: "ns-resize",
  left: "ew-resize",
  right: "ew-resize",
  "top-left": "nwse-resize",
  "top-right": "nesw-resize",
  "bottom-left": "nesw-resize",
  "bottom-right": "nwse-resize",
};

const DesktopWindow = memo(DesktopWindowInner);
export default DesktopWindow;
