"use client";

import { memo, useCallback } from "react";
import { tokens } from "@/lib/tokens";
import WindowControls from "./WindowControls";

const c = tokens.color;

interface WindowHeaderProps {
  title: string;
  icon?: React.ReactNode;
  focused: boolean;
  closable: boolean;
  minimized: boolean;
  maximized: boolean;
  draggable: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

function WindowHeaderInner({
  title,
  icon,
  focused,
  closable,
  minimized,
  maximized,
  draggable,
  onDragStart,
  onClose,
  onMinimize,
  onMaximize,
}: WindowHeaderProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (draggable) {
        onDragStart(e);
      }
    },
    [draggable, onDragStart]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMaximize();
    },
    [onMaximize]
  );

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 border-b px-3 select-none"
      style={{
        borderColor: focused ? "rgba(229,0,0,0.18)" : "rgba(255,255,255,0.06)",
        background: focused ? "rgba(255,255,255,0.035)" : "transparent",
        cursor: draggable ? "grab" : "default",
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon && (
          <span className="shrink-0 text-[11px] text-jarvis-red">
            {icon}
          </span>
        )}
        <span
          className="truncate text-[11.5px] font-medium tracking-wide"
          style={{
            color: focused ? c.textPrimary : c.textMuted,
          }}
        >
          {title}
        </span>
      </div>

      <WindowControls
        closable={closable}
        minimized={minimized}
        maximized={maximized}
        onClose={onClose}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
      />
    </div>
  );
}

const WindowHeader = memo(WindowHeaderInner);
export default WindowHeader;
