"use client";

import { memo, useMemo } from "react";
import ParticleSystem from "./ParticleSystem";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";

const orb = tokens.orb;

interface OrbParticlesProps {
  state: OrbState;
  radius: number;
}

const STATE_SPEED: Record<OrbState, number> = {
  idle: 7,
  listening: 4,
  thinking: 2.5,
  speaking: 3,
  executing: 1.5,
  offline: 0,
  error: 1,
};

const STATE_SPREAD: Record<OrbState, number> = {
  idle: 80,
  listening: 100,
  thinking: 60,
  speaking: 90,
  executing: 120,
  offline: 0,
  error: 50,
};

function OrbParticlesInner({ state, radius }: OrbParticlesProps) {
  const count = orb.particleCount[state];
  const color = orb.core[state];
  const speed = STATE_SPEED[state];
  const spread = STATE_SPREAD[state];

  const config = useMemo(
    () => ({ count, color, speed, spread }),
    [count, color, speed, spread]
  );

  if (count === 0) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: radius * 2,
        height: radius * 2,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <ParticleSystem
        count={config.count}
        color={config.color}
        speed={config.speed}
        radius={radius}
        spread={config.spread}
        size={state === "executing" ? 4 : 3}
      />
    </div>
  );
}

const OrbParticles = memo(OrbParticlesInner);
export default OrbParticles;
