import { tokens } from "@/lib/tokens";

const dur = tokens.duration;

/** Standard window open/close transition */
export const windowTransition = {
  duration: dur.medium / 1000,
  ease: "easeOut" as const,
};

/** Maximize/restore/snap animation with spring physics */
export const snapTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/** Border radius transition for maximize/restore */
export const borderRadiusTransition = {
  duration: dur.small / 1000,
  ease: "easeOut" as const,
};

/** Glass opacity transition for maximize/restore */
export const glassTransition = {
  duration: dur.medium / 1000,
  ease: "easeOut" as const,
};

/** Get the target style for a window based on its state */
export function getWindowStyle(win: {
  maximized: boolean;
  isSnapped: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  focused: boolean;
}): React.CSSProperties {
  if (win.maximized) {
    return {
      inset: 0,
      width: "100%",
      height: "100%",
      zIndex: win.zIndex,
    };
  }
  return {
    left: win.x,
    top: win.y,
    width: win.width,
    height: win.height,
    zIndex: win.zIndex,
  };
}
