"use client";

import { memo } from "react";

interface WindowBodyProps {
  children: React.ReactNode;
  focused: boolean;
}

function WindowBodyInner({ children, focused }: WindowBodyProps) {
  return (
    <div
      className="flex-1 overflow-auto"
      style={{
        opacity: focused ? 1 : 0.7,
        transition: "opacity 200ms ease",
      }}
    >
      {children}
    </div>
  );
}

const WindowBody = memo(WindowBodyInner);
export default WindowBody;
