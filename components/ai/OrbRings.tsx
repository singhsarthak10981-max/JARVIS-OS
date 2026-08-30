"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";

interface OrbRingsProps {
  state: OrbState;
  wakeUp: boolean;
}

const SEGMENTS = 12;

function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
) {
  const angle = ((angleDeg - 90) * Math.PI) / 180;

  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
  ].join(" ");
}

function OrbRingsInner({ state, wakeUp }: OrbRingsProps) {
  const isOffline = state === "offline";
  const isError = state === "error";
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isExecuting = state === "executing";

  if (isOffline) return null;

  // Primary AI Core energy.
  const blue = "#42C8FF";
  const cyan = "#00E5FF";
  const white = "#FFFFFF";
  const warning = "#FF3030";

  const primary = isError ? warning : blue;
  const secondary = isError ? warning : cyan;

  const rotationDuration = isExecuting
    ? 7
    : isThinking
      ? 11
      : isSpeaking
        ? 18
        : 28;

  return (
    <div className="pointer-events-none absolute inset-[-48px]">
      <motion.svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full"
        animate={
          isError
            ? { rotate: [0, 2, -2, 1, -1, 0] }
            : {
                rotate: state === "idle" ? 360 : -360,
              }
        }
        transition={
          isError
            ? {
                duration: 0.35,
                repeat: Infinity,
                ease: "linear",
              }
            : {
                duration: rotationDuration,
                repeat: Infinity,
                ease: "linear",
              }
        }
      >
        {/* OUTER PRECISION RINGS */}

        <circle
          cx="200"
          cy="200"
          r="180"
          fill="none"
          stroke={`${primary}18`}
          strokeWidth="1"
        />

        <circle
          cx="200"
          cy="200"
          r="172"
          fill="none"
          stroke={`${secondary}20`}
          strokeWidth="2"
        />

        <circle
          cx="200"
          cy="200"
          r="166"
          fill="none"
          stroke={`${primary}12`}
          strokeWidth="1"
          strokeDasharray="2 12"
        />

        {/* 12 POWER SEGMENTS */}

        {Array.from({ length: SEGMENTS }).map((_, index) => {
          const start =
            index * (360 / SEGMENTS) + 2.5;

          const end = start + 360 / SEGMENTS - 5;

          const major = index % 3 === 0;

          return (
            <motion.path
              key={`segment-${index}`}
              d={arcPath(200, 200, 156, start, end)}
              fill="none"
              stroke={major ? secondary : primary}
              strokeWidth={major ? 4 : 2}
              strokeLinecap="butt"
              animate={{
                opacity:
                  isExecuting
                    ? major
                      ? [0.4, 1, 0.4]
                      : [0.2, 0.7, 0.2]
                    : isThinking
                      ? major
                        ? [0.5, 1, 0.5]
                        : [0.25, 0.6, 0.25]
                      : isListening
                        ? major
                          ? [0.65, 1, 0.65]
                          : [0.35, 0.65, 0.35]
                        : isSpeaking
                          ? [0.55, 1, 0.55]
                          : [0.35, 0.62, 0.35],
              }}
              transition={{
                duration: isExecuting
                  ? 1
                  : isThinking
                    ? 1.5
                    : isSpeaking
                      ? 2
                      : 2.8,
                repeat: Infinity,
                delay: index * 0.06,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* INNER MECHANICAL RINGS */}

        <circle
          cx="200"
          cy="200"
          r="138"
          fill="none"
          stroke={`${primary}18`}
          strokeWidth="1"
        />

        <circle
          cx="200"
          cy="200"
          r="126"
          fill="none"
          stroke={`${secondary}28`}
          strokeWidth="3"
          strokeDasharray="34 13 8 17"
        />

        <motion.circle
          cx="200"
          cy="200"
          r="112"
          fill="none"
          stroke={`${primary}20`}
          strokeWidth="1"
          strokeDasharray="4 10"
          animate={{ rotate: -360 }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        {/* CONTROLLED ENERGY ARCS */}

        <motion.path
          d={arcPath(200, 200, 148, 12, 86)}
          fill="none"
          stroke={secondary}
          strokeWidth="5"
          strokeLinecap="round"
          opacity={0.8}
          animate={
            wakeUp
              ? { pathLength: [0, 1, 0.7, 1] }
              : isExecuting
                ? { pathLength: [0.2, 1, 0.2] }
                : isThinking
                  ? { pathLength: [0.35, 1, 0.35] }
                  : isSpeaking
                    ? { pathLength: [0.6, 1, 0.6] }
                    : isListening
                      ? { pathLength: [0.65, 0.95, 0.65] }
                      : { opacity: [0.4, 0.8, 0.4] }
          }
          transition={{
            duration: isExecuting
              ? 1.2
              : isThinking
                ? 1.8
                : isSpeaking
                  ? 2.2
                  : 3.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.path
          d={arcPath(200, 200, 148, 190, 278)}
          fill="none"
          stroke={primary}
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.48}
          animate={{
            pathLength:
              isExecuting
                ? [0.25, 1, 0.25]
                : isThinking
                  ? [0.4, 0.9, 0.4]
                  : [0.35, 0.65, 0.35],
          }}
          transition={{
            duration: isExecuting ? 1.4 : 3.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* INNER POWER RINGS */}

        <circle
          cx="200"
          cy="200"
          r="88"
          fill="none"
          stroke={`${secondary}25`}
          strokeWidth="2"
        />

        <circle
          cx="200"
          cy="200"
          r="74"
          fill="none"
          stroke={`${primary}20`}
          strokeWidth="1"
        />

        {/* 12 RADIAL POWER NODES */}

        {Array.from({ length: SEGMENTS }).map((_, index) => {
          const angle = index * (360 / SEGMENTS);
          const point = polarPoint(200, 200, 176, angle);

          const active =
            isExecuting
              ? index % 2 === 0
              : isThinking
                ? index % 3 !== 1
                : isListening
                  ? index % 2 === 0
                  : true;

          return (
            <motion.circle
              key={`node-${index}`}
              cx={point.x}
              cy={point.y}
              r={index % 3 === 0 ? 4 : 2.5}
              fill={active ? secondary : primary}
              animate={{
                opacity: active
                  ? [0.3, 1, 0.3]
                  : [0.15, 0.4, 0.15],
                scale: active
                  ? [0.9, 1.15, 0.9]
                  : 1,
              }}
              transition={{
                duration: isExecuting
                  ? 0.8
                  : isThinking
                    ? 1.2
                    : isListening
                      ? 1.8
                      : 2.8,
                repeat: Infinity,
                delay: index * 0.07,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* WHITE HOT INNER CORE */}

        <motion.circle
          cx="200"
          cy="200"
          r="34"
          fill={`${white}10`}
          stroke={`${white}55`}
          strokeWidth="1"
          animate={{
            opacity: isThinking || isExecuting
              ? [0.55, 1, 0.55]
              : [0.7, 0.95, 0.7],
            r:
              isSpeaking
                ? [34, 38, 34]
                : [34, 35.5, 34],
          }}
          transition={{
            duration: isExecuting
              ? 1
              : isThinking
                ? 1.4
                : 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.svg>

      {/* Precision corner markers */}

      <div className="absolute left-[9%] top-[27%] h-6 w-6 border-l border-t border-cyan-300/25" />

      <div className="absolute right-[9%] top-[27%] h-6 w-6 border-r border-t border-cyan-300/25" />

      <div className="absolute bottom-[27%] left-[9%] h-6 w-6 border-b border-l border-cyan-300/18" />

      <div className="absolute bottom-[27%] right-[9%] h-6 w-6 border-b border-r border-cyan-300/18" />
    </div>
  );
}

const OrbRings = memo(OrbRingsInner);

export default OrbRings;