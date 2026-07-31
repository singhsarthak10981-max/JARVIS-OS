export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SnapPosition = "left" | "right" | "maximized" | null;

export interface WindowInstance {
  id: string;
  moduleId: string;
  title: string;
  icon?: React.ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  minimized: boolean;
  maximized: boolean;
  focused: boolean;
  resizable: boolean;
  closable: boolean;
  draggable: boolean;
  zIndex: number;
  previousBounds: WindowBounds | null;
  isSnapped: boolean;
  snapPosition: SnapPosition;
}
