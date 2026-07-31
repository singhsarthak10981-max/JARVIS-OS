"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";

export default function WallpaperRenderer() {
  const wallpaper = useAppStore((s) => s.wallpaper);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (wallpaper.type !== "animated") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      time += 0.005;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const presets = tokens.wallpaper.presets as Record<string, { primary: string; secondary: string; accent: string; gradient: string }>;
      const preset = presets[wallpaper.preset] || presets["tactical-red"];

      const x1 = w * 0.5 + Math.cos(time) * w * 0.3;
      const y1 = h * 0.5 + Math.sin(time * 0.7) * h * 0.3;
      const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, w * 0.6);
      grad1.addColorStop(0, preset.primary + "33");
      grad1.addColorStop(1, "transparent");
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      const x2 = w * 0.5 + Math.cos(time * 1.3) * w * 0.25;
      const y2 = h * 0.5 + Math.sin(time * 0.9) * h * 0.25;
      const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, w * 0.5);
      grad2.addColorStop(0, preset.secondary + "44");
      grad2.addColorStop(1, "transparent");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [wallpaper]);

  const presets = tokens.wallpaper.presets as Record<string, { primary: string; secondary: string; accent: string; gradient: string }>;
  const preset = presets[wallpaper.preset] || presets["tactical-red"];

  if (wallpaper.type === "animated") {
    return (
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0"
        style={{ background: "#050505" }}
      />
    );
  }

  if (wallpaper.type === "solid") {
    return (
      <div
        className="fixed inset-0 z-0"
        style={{ background: wallpaper.primaryColor }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-0"
      style={{
        background: preset.gradient || `linear-gradient(135deg, ${wallpaper.primaryColor} 0%, ${wallpaper.secondaryColor} 50%, #050505 100%)`,
      }}
    />
  );
}
