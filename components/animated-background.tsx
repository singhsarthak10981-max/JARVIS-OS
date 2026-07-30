"use client";

import { useEffect, useRef } from "react";
import { tokens } from "@/lib/tokens";

const PARTICLE_COUNT = 40;
const c = tokens.color;

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<
    { x: number; y: number; size: number; speedY: number; speedX: number; opacity: number }[]
  >([]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speedY: -(Math.random() * 0.3 + 0.1),
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.5 + 0.1,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.y += p.speedY;
        p.x += p.speedX;
        p.opacity += (Math.random() - 0.5) * 0.01;
        p.opacity = Math.max(0.05, Math.min(0.6, p.opacity));

        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(229, 0, 0, ${p.opacity})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(229, 0, 0, ${p.opacity * 0.15})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(229,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(229,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          animation: "hex-pulse 8s ease-in-out infinite",
        }}
      />

      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-1/2 top-1/4 h-[600px] w-[600px] rounded-full opacity-[0.04]"
          style={{
            background: `radial-gradient(circle, ${c.jarvisRed} 0%, transparent 70%)`,
            animation: "gradient-shift 15s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -right-1/4 top-1/2 h-[500px] w-[500px] rounded-full opacity-[0.03]"
          style={{
            background: `radial-gradient(circle, ${c.jarvisRed} 0%, transparent 70%)`,
            animation: "gradient-shift 20s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[400px] w-[800px] rounded-full opacity-[0.025]"
          style={{
            background: `radial-gradient(ellipse, ${c.crimson} 0%, transparent 70%)`,
            animation: "gradient-shift 12s ease-in-out infinite",
          }}
        />
      </div>

      <div className="absolute inset-0 overflow-hidden opacity-[0.06]">
        <div
          className="absolute h-full w-full"
          style={{
            background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(229,0,0,0.03) 2px, rgba(229,0,0,0.03) 4px)`,
          }}
        />
      </div>

      <div
        className="absolute left-0 h-[2px] w-full opacity-[0.12]"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(229,0,0,0.6) 20%, rgba(229,0,0,0.8) 50%, rgba(229,0,0,0.6) 80%, transparent)`,
          animation: "scanline 8s linear infinite",
        }}
      />

      <div
        className="absolute left-0 h-[1px] w-full opacity-[0.04]"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(229,0,0,0.4) 30%, rgba(229,0,0,0.5) 50%, rgba(229,0,0,0.4) 70%, transparent)`,
          animation: "scanline 5s linear infinite",
          animationDelay: "-3s",
        }}
      />
    </div>
  );
}
