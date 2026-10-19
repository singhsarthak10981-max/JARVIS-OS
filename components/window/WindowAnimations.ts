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

/** Minimum gap kept between a window edge and the workspace edge. */
const EDGE_MARGIN = 8;

/**
 * Vertical strip reserved for the floating dock at the bottom of the shell.
 * Dock max height (56) + offset (16) + breathing room (12).
 */
export const DOCK_SAFE_AREA = 84;

interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Clamp stored window geometry into the available workspace.
 *
 * Windows persist their own x/y/width/height in the store. Those values are
 * not aware of the current viewport, so a 1000x680 default window opened on a
 * 1024px-wide screen used to render past the right/bottom edge (and underneath
 * the dock). Clamping is applied at render time so the stored geometry is kept
 * intact and the window snaps back once space is available again.
 */
export function clampToContainer(
  geometry: WindowGeometry,
  containerWidth: number,
  containerHeight: number
): WindowGeometry {
  if (containerWidth <= 0 || containerHeight <= 0) return geometry;

  const maxWidth = Math.max(0, containerWidth - EDGE_MARGIN);
  const maxHeight = Math.max(0, containerHeight - EDGE_MARGIN);
  const width = Math.min(geometry.width, maxWidth);
  const height = Math.min(geometry.height, maxHeight);

  return {
    width,
    height,
    x: Math.max(0, Math.min(geometry.x, maxWidth - width)),
    y: Math.max(0, Math.min(geometry.y, maxHeight - height)),
  };
}

/** Get the target style for a window based on its state */
export function getWindowStyle(
  win: {
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
  },
  containerWidth = 0,
  containerHeight = 0
): React.CSSProperties {
  if (win.maximized) {
    return {
      inset: 0,
      width: "100%",
      height: "100%",
      zIndex: win.zIndex,
    };
  }

  const { x, y, width, height } = clampToContainer(
    win,
    containerWidth,
    containerHeight
  );

  return {
    left: x,
    top: y,
    width,
    height,
    zIndex: win.zIndex,
  };
}
