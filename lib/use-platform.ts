"use client";

import { useEffect, useState } from "react";
import { detectPlatform, type Platform } from "./platform";

/**
 * Platform detection for rendered keyboard hints.
 *
 * Server rendering has no navigator, so the first paint assumes the common
 * case (Ctrl). After hydration the value is corrected for macOS. This avoids
 * showing "⌘" to Windows users (the primary target) on first paint.
 */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform((current) => (current === detected ? current : detected));
  }, []);

  return platform;
}
