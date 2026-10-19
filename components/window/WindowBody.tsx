"use client";

import { memo } from "react";

interface WindowBodyProps {
  children: React.ReactNode;
  focused: boolean;
}

function WindowBodyInner({ children, focused }: WindowBodyProps) {
  return (
    <div
      className="flex-1 overflow-auto jarvis-scroll"
      style={{
        // The header and shadow carry the focus signal; body text stays
        // readable so a background window can still be scanned.
        opacity: focused ? 1 : 0.88,
        transition: "opacity 200ms ease",
      }}
    >
      {children}
    </div>
  );
}

const WindowBody = memo(WindowBodyInner);
export default WindowBody;
