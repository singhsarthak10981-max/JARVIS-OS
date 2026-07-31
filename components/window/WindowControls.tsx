"use client";

import { memo, useCallback } from "react";
import { tokens } from "@/lib/tokens";

const dur = tokens.duration;

interface WindowControlsProps {
  closable: boolean;
  minimized: boolean;
  maximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

function WindowControlsInner({
  closable,
  minimized,
  maximized,
  onClose,
  onMinimize,
  onMaximize,
}: WindowControlsProps) {
  const handleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMinimize();
    },
    [onMinimize]
  );

  const handleMaximize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMaximize();
    },
    [onMaximize]
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleMinimize}
        className="group flex h-[13px] w-[13px] items-center justify-center rounded-full bg-jarvis-text-disabled/30 transition-all duration-200 hover:bg-jarvis-warning"
        aria-label="Minimize"
      >
        <svg
          width="8"
          height="2"
          viewBox="0 0 8 2"
          fill="none"
          className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          <path d="M0 1H8" stroke={tokens.color.bgPrimary} strokeWidth="1.5" />
        </svg>
      </button>

      <button
        onClick={handleMaximize}
        className="group flex h-[13px] w-[13px] items-center justify-center rounded-full bg-jarvis-text-disabled/30 transition-all duration-200 hover:bg-jarvis-success"
        aria-label={maximized ? "Restore" : "Maximize"}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          {maximized ? (
            <path
              d="M1 5.5V7.5H3.5M4.5 0.5H6.5V2.5M1.5 7.5H0.5V6.5M7.5 1.5V0.5H6.5"
              stroke={tokens.color.bgPrimary}
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <rect
              x="0.5"
              y="0.5"
              width="7"
              height="7"
              rx="1"
              stroke={tokens.color.bgPrimary}
              strokeWidth="1"
            />
          )}
        </svg>
      </button>

      {closable && (
        <button
          onClick={handleClose}
          className="group flex h-[13px] w-[13px] items-center justify-center rounded-full bg-jarvis-text-disabled/30 transition-all duration-200 hover:bg-jarvis-red"
          aria-label="Close"
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <path
              d="M1 1L7 7M7 1L1 7"
              stroke={tokens.color.bgPrimary}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

const WindowControls = memo(WindowControlsInner);
export default WindowControls;
