"use client";

import { useEffect, useRef } from "react";

const TEXT_ENTRY_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]), textarea, [contenteditable="true"]';

/**
 * A compact, theme-aware precision reticle for desktop pointers.
 *
 * Position is written directly to a compositor-friendly transform rather than
 * animated toward the pointer. The overlay never intercepts pointer events.
 */
export default function ReticleCursor() {
  const reticleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    if (!finePointer.matches) return;

    const root = document.documentElement;
    const element = reticleRef.current;
    if (!element) return;

    let cursorActive = false;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        element.style.opacity = "0";
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR)) {
        // Keep the native text caret easy to see while editing.
        element.style.opacity = "0";
        return;
      }

      // No easing or trailing interpolation: the reticle tracks the real
      // pointer position immediately, with transform-only updates.
      element.style.transform =
        `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate3d(-50%, -50%, 0)`;
      element.style.opacity = "1";

      if (!cursorActive) {
        root.classList.add("jarvis-reticle-active");
        cursorActive = true;
      }
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        element.style.opacity = "0";
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
