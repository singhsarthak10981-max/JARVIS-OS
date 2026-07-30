"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";

const dur = tokens.duration;

interface ParticleSystemProps {
  count: number;
  color: string;
  speed: number;
  radius: number;
  spread: number;
  size?: number;
}

interface ParticleData {
  id: number;
  px: number;
  py: number;
  delay: number;
  duration: number;
  size: number;
}

function generateParticles(
  count: number,
  spread: number,
  speed: number,
  size: number
): ParticleData[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = spread * (0.5 + Math.random() * 0.5);
    return {
      id: i,
      px: Math.cos(angle) * distance,
      py: Math.sin(angle) * distance,
      delay: Math.random() * speed * 0.6,
      duration: speed * (0.7 + Math.random() * 0.6),
      size: size * (0.4 + Math.random() * 0.6),
    };
  });
}

function ParticleSystemInner({
  count,
  color,
  speed,
  radius,
  spread,
  size = 3,
}: ParticleSystemProps) {
  const particles = useMemo(
    () => generateParticles(count, spread, speed, size),
    [count, spread, speed, size]
  );

  if (count === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: radius * 2, height: radius * 2 }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
            left: "50%",
            top: "50%",
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
          animate={{
            x: [0, p.px * 0.5, p.px],
            y: [0, p.py * 0.5, p.py],
            opacity: [0, 0.8, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

const ParticleSystem = memo(ParticleSystemInner);
export default ParticleSystem;
