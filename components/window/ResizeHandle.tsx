"use client";

import { memo, useCallback } from "react";

type ResizeEdge = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface ResizeHandleProps {
  edge: ResizeEdge;
  onResizeStart: (e: React.MouseEvent, edge: ResizeEdge) => void;
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

const HANDLE_SIZE = 8;

function getEdgeStyle(edge: ResizeEdge, size: number): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    zIndex: 10,
  };

  switch (edge) {
    case "top":
      return {
        ...base,
        top: -size / 2,
        left: size,
        right: size,
        height: size,
        cursor: CURSORS[edge],
      };
    case "bottom":
      return {
        ...base,
        bottom: -size / 2,
        left: size,
        right: size,
        height: size,
        cursor: CURSORS[edge],
      };
    case "left":
      return {
        ...base,
        left: -size / 2,
        top: size,
        bottom: size,
        width: size,
        cursor: CURSORS[edge],
      };
    case "right":
      return {
        ...base,
        right: -size / 2,
        top: size,
        bottom: size,
        width: size,
        cursor: CURSORS[edge],
      };
    case "top-left":
      return {
        ...base,
        top: -size / 2,
        left: -size / 2,
        width: size * 1.5,
        height: size * 1.5,
        cursor: CURSORS[edge],
      };
    case "top-right":
      return {
        ...base,
        top: -size / 2,
        right: -size / 2,
        width: size * 1.5,
        height: size * 1.5,
        cursor: CURSORS[edge],
      };
    case "bottom-left":
      return {
        ...base,
        bottom: -size / 2,
        left: -size / 2,
        width: size * 1.5,
        height: size * 1.5,
        cursor: CURSORS[edge],
      };
    case "bottom-right":
      return {
        ...base,
        bottom: -size / 2,
        right: -size / 2,
        width: size * 1.5,
        height: size * 1.5,
        cursor: CURSORS[edge],
      };
  }
}

function ResizeHandleInner({ edge, onResizeStart }: ResizeHandleProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onResizeStart(e, edge);
    },
    [edge, onResizeStart]
  );

  return (
    <div
      className="pointer-events-auto"
      style={getEdgeStyle(edge, HANDLE_SIZE)}
      onMouseDown={handleMouseDown}
    />
  );
}

const ResizeHandle = memo(ResizeHandleInner);
export default ResizeHandle;
export type { ResizeEdge };
