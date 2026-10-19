"use client";

import { useEffect, useRef } from "react";

/**
 * A small, theme-aware reticle for desktop pointers. It never receives pointer
 * events, and is not enabled for touch-only devices.
 */
export default function ReticleCursor() {
  const reticleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    if (!finePointer.matches) return;

    const root = document.documentElement;
    root.classList.add("jarvis-reticle-active");

    const handlePointerMove = (event: PointerEvent) => {
      const element = reticleRef.current;
      if (!element) return;

      if (event.pointerType === "touch") {
        element.style.opacity = "0";
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]), textarea, [contenteditable="true"]'
        )
      ) {
        // Keep the native text caret easy to see while editing.
        element.style.opacity = "0";
        return;
      }

      element.style.transform =
        `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
      const interactive =
        target instanceof Element &&
        Boolean(
          target.closest(
            'button, a, select, [role="button"], [data-cursor-interactive]'
          )
        );

      element.dataset.interactive = String(interactive);
      element.style.opacity = "1";
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null && reticleRef.current) {
        reticleRef.current.style.opacity = "0";
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerout", handlePointerOut);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerOut);
      root.classList.remove("jarvis-reticle-active");
    };
  }, []);

  return (
    <div ref={reticleRef} className="jarvis-reticle" aria-hidden="true">
      <span className="jarvis-reticle__ring" />
      <span className="jarvis-reticle__tick jarvis-reticle__tick--vertical jarvis-reticle__tick--top" />
      <span className="jarvis-reticle__tick jarvis-reticle__tick--vertical jarvis-reticle__tick--bottom" />
      <span className="jarvis-reticle__tick jarvis-reticle__tick--horizontal jarvis-reticle__tick--left" />
      <span className="jarvis-reticle__tick jarvis-reticle__tick--horizontal jarvis-reticle__tick--right" />
    </div>
  );
}
