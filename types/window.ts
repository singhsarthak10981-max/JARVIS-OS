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
}
