"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

interface NeuralSigilProps {
  size?: number;
  active?: boolean;
}

const C = {
  crimson: "#7C0A0A",
  fire: "#E63600",
  amber: "#FFB81C",
  white: "#FFF4DC",
  starlight: "#E2E8F0",
};

const OUTER_SEGMENTS = 32;
const INNER_TICKS = 24;
const NODES = 12;

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
  const start = polarPoint(
    cx,
    cy,
    radius,
    startAngle,
  );

  const end = polarPoint(
    cx,
    cy,
    radius,
    endAngle,
  );

  const largeArc =
    endAngle - startAngle > 180 ? 1 : 0;

  return `
    M ${start.x} ${start.y}
    A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}
  `;
}

export default function NeuralSigil({
  size = 390,
  active = true,
}: NeuralSigilProps) {
  const aiState = useAppStore((s) => s.aiState);

  const isListening = aiState === "listening";
  const isThinking = aiState === "thinking";
  const isSpeaking = aiState === "speaking";
  const isExecuting = aiState === "executing";
  const isOffline = aiState === "offline";
  const isError = aiState === "error";

  /*
   * ================================================================
   * STATE PROFILES
   * ================================================================
   *
   * Everything here controls how the reactor behaves.
   * The geometry stays the same — only its behavior changes.
   */

  const outerSpeed = isExecuting
    ? 11
    : isThinking
      ? 18
      : isSpeaking
        ? 24
        : isListening
          ? 30
          : 44;

  const middleSpeed = isExecuting
    ? 8
    : isThinking
      ? 12
      : isSpeaking
        ? 18
        : isListening
          ? 22
          : 30;

  const innerSpeed = isExecuting
    ? 5
    : isThinking
      ? 8
      : isSpeaking
        ? 11
        : isListening
          ? 15
          : 20;

  const corePulseDuration = isExecuting
    ? 0.65
    : isThinking
      ? 1
      : isSpeaking
        ? 1.2
        : isListening
          ? 1.7
          : 3;

  const primaryGlow = isError
    ? C.crimson
    : isOffline
      ? C.crimson
      : C.fire;

  const activeAccent = isError
    ? C.crimson
    : C.amber;

  /*
   * Intensity is deliberately different by state.
   * Idle stays quiet so the background video remains dominant.
   */

  const intensity = isError
    ? 1
    : isExecuting
      ? 1
      : isThinking
        ? 0.9
        : isSpeaking
          ? 0.82
          : isListening
            ? 0.74
            : isOffline
              ? 0.18
              : 0.42;

  return (
    <motion.div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
      }}
      animate={{
        scale: active
          ? isExecuting
            ? [1, 1.012, 1]
            : isThinking
              ? [1, 1.008, 1]
              : isSpeaking
                ? [1, 1.009, 1]
                : [1, 1.004, 1]
          : 1,
      }}
      transition={{
        duration: isExecuting
          ? 0.8
          : isThinking
            ? 1.2
            : 4.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {/* ========================================================== */}
      {/* AMBIENT THERMAL FIELD                                     */}
      {/* ========================================================== */}

      <motion.div
        className="absolute inset-[-11%] rounded-full"
        style={{
          background: `
            radial-gradient(
              circle,
              ${primaryGlow}1C 0%,
              ${C.crimson}10 28%,
              transparent 72%
            )
          `,
          filter: "blur(18px)",
        }}
        animate={{
          opacity: isOffline
            ? [0.08, 0.12, 0.08]
            : isError
              ? [0.4, 0.9, 0.4]
              : [
                  0.22 * intensity,
                  0.48 * intensity,
                  0.22 * intensity,
                ],
          scale: isExecuting
            ? [0.97, 1.07, 0.97]
            : isThinking
              ? [0.98, 1.05, 0.98]
              : [0.99, 1.02, 0.99],
        }}
        transition={{
          duration: isError
            ? 0.7
            : isExecuting
              ? 0.8
              : isThinking
                ? 1.2
                : 3.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`J.A.R.V.I.S. Neural Core — ${aiState}`}
      >
        {/* ======================================================== */}
        {/* OUTER CONTAINMENT                                       */}
        {/* ======================================================== */}

        <circle
          cx="200"
          cy="200"
          r="195"
          fill="none"
          stroke={`${C.crimson}${isOffline ? "30" : "65"}`}
          strokeWidth="0.8"
        />

        <motion.circle
          cx="200"
          cy="200"
          r="189"
          fill="none"
          stroke={
            isError
              ? `${C.crimson}95`
              : `${C.fire}48`
          }
          strokeWidth="0.7"
          strokeDasharray="2 10"
          animate={{
            rotate: 360,
            opacity: isOffline
              ? [0.18, 0.28, 0.18]
              : isError
                ? [0.45, 1, 0.45]
                : [
                    0.45 * intensity,
                    0.8 * intensity,
                    0.45 * intensity,
                  ],
          }}
          transition={{
            rotate: {
              duration: outerSpeed,
              repeat: Infinity,
              ease: "linear",
            },
            opacity: {
              duration: isError
                ? 0.7
                : corePulseDuration * 1.6,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        <motion.circle
          cx="200"
          cy="200"
          r="181"
          fill="none"
          stroke={`${C.amber}${isOffline ? "1E" : "48"}`}
          strokeWidth="1.1"
          strokeDasharray="25 9 4 14"
          animate={{
            rotate: -360,
          }}
          transition={{
            duration: outerSpeed + 9,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        {/* ======================================================== */}
        {/* SEGMENTED THERMAL RING                                  */}
        {/* ======================================================== */}

        {Array.from({
          length: OUTER_SEGMENTS,
        }).map((_, index) => {
          const segment =
            360 / OUTER_SEGMENTS;

          const gap =
            index % 4 === 0
              ? 4
              : 6;

          const start =
            index * segment + gap / 2;

          const end =
            start + segment - gap;

          const major = index % 4 === 0;
          const hot = index % 8 === 0;

          return (
            <motion.path
              key={`segment-${index}`}
              d={arcPath(
                200,
                200,
                164,
                start,
                end,
              )}
              fill="none"
              stroke={
                hot
                  ? activeAccent
                  : major
                    ? C.fire
                    : C.crimson
              }
              strokeWidth={
                hot
                  ? 2.7
                  : major
                    ? 1.6
                    : 0.9
              }
              animate={{
                opacity: isOffline
                  ? 0.08
                  : isError
                    ? [
                        0.2,
                        hot ? 0.95 : 0.55,
                        0.2,
                      ]
                    : hot
                      ? [
                          0.3 * intensity,
                          0.95 * intensity,
                          0.3 * intensity,
                        ]
                      : major
                        ? [
                            0.18 * intensity,
                            0.62 * intensity,
                            0.18 * intensity,
                          ]
                        : [
                            0.08 * intensity,
                            0.28 * intensity,
                            0.08 * intensity,
                          ],
              }}
              transition={{
                duration: isError
                  ? 0.7
                  : hot
                    ? isExecuting
                      ? 0.8
                      : 1.8
                    : major
                      ? 2.6
                      : 3.8,
                delay:
                  index * 0.045,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* ======================================================== */}
        {/* INDEX TICKS                                             */}
        {/* ======================================================== */}

        {Array.from({
          length: INNER_TICKS,
        }).map((_, index) => {
          const angle = index * 15;

          const outer = polarPoint(
            200,
            200,
            153,
            angle,
          );

          const inner = polarPoint(
            200,
            200,
            index % 3 === 0
              ? 143
              : 147,
            angle,
          );

          return (
            <line
              key={`tick-${index}`}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={
                index % 3 === 0
                  ? `${C.amber}${isOffline ? "18" : "70"}`
                  : `${C.fire}${isOffline ? "12" : "42"}`
              }
              strokeWidth={
                index % 3 === 0
                  ? 1.15
                  : 0.7
              }
            />
          );
        })}

        {/* ======================================================== */}
        {/* MIDDLE ORBIT                                           */}
        {/* ======================================================== */}

        <circle
          cx="200"
          cy="200"
          r="146"
          fill="none"
          stroke={`${C.crimson}${isOffline ? "15" : "48"}`}
          strokeWidth="0.8"
        />

        <motion.circle
          cx="200"
          cy="200"
          r="138"
          fill="none"
          stroke={`${C.fire}${isOffline ? "18" : "62"}`}
          strokeWidth="1.2"
          strokeDasharray="54 16 6 20"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: middleSpeed,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        <motion.circle
          cx="200"
          cy="200"
          r="127"
          fill="none"
          stroke={`${C.amber}${isOffline ? "15" : "45"}`}
          strokeWidth="1"
          strokeDasharray="3 8"
          animate={{
            rotate: -360,
          }}
          transition={{
            duration: middleSpeed + 5,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        <circle
          cx="200"
          cy="200"
          r="116"
          fill="none"
          stroke={`${C.crimson}${isOffline ? "16" : "52"}`}
          strokeWidth="0.8"
        />

        {/* ======================================================== */}
        {/* INNER ENERGY SYSTEM                                      */}
        {/* ======================================================== */}

        <motion.circle
          cx="200"
          cy="200"
          r="104"
          fill="none"
          stroke={`${C.fire}${isOffline ? "18" : "70"}`}
          strokeWidth="1.6"
          strokeDasharray="66 19"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: innerSpeed,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        <motion.circle
          cx="200"
          cy="200"
          r="92"
          fill="none"
          stroke={`${C.amber}${isOffline ? "14" : "55"}`}
          strokeWidth="0.9"
          strokeDasharray="2 7"
          animate={{
            rotate: -360,
          }}
          transition={{
            duration: innerSpeed - 1 > 2
              ? innerSpeed - 1
              : 2,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        {/* ======================================================== */}
        {/* EYE SILHOUETTE                                          */}
        {/* ======================================================== */}

        <motion.g
          animate={{
            scale:
              isListening
                ? [1, 1.015, 1]
                : isThinking
                  ? [1, 0.985, 1.02, 1]
                  : isSpeaking
                    ? [1, 1.018, 1]
                    : isExecuting
                      ? [1, 0.975, 1.01, 1]
                      : [1, 1.004, 1],
          }}
          transition={{
            duration:
              isThinking
                ? 1.1
                : isExecuting
                  ? 0.7
                  : 3.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        >
          {/* upper eye */}
          <path
            d="
              M 103 200
              C 127 157, 165 134, 200 134
              C 235 134, 273 157, 297 200
            "
            fill="none"
            stroke={`${C.fire}${isOffline ? "25" : "88"}`}
            strokeWidth="2"
          />

          {/* lower eye */}
          <path
            d="
              M 103 200
              C 127 243, 165 266, 200 266
              C 235 266, 273 243, 297 200
            "
            fill="none"
            stroke={`${C.fire}${isOffline ? "22" : "74"}`}
            strokeWidth="2"
          />

          {/* inner upper */}
          <path
            d="
              M 122 200
              C 144 169, 172 151, 200 151
              C 228 151, 256 169, 278 200
            "
            fill="none"
            stroke={`${C.amber}${isOffline ? "18" : "65"}`}
            strokeWidth="1"
          />

          {/* inner lower */}
          <path
            d="
              M 122 200
              C 144 231, 172 249, 200 249
              C 228 249, 256 231, 278 200
            "
            fill="none"
            stroke={`${C.amber}${isOffline ? "15" : "55"}`}
            strokeWidth="1"
          />
        </motion.g>

        {/* ======================================================== */}
        {/* IRIS                                                   */}
        {/* ======================================================== */}

        <motion.circle
          cx="200"
          cy="200"
          r="69"
          fill={`${C.crimson}${isOffline ? "03" : "08"}`}
          stroke={`${C.fire}${isOffline ? "20" : "72"}`}
          strokeWidth="1.4"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration:
              isExecuting
                ? 8
                : isThinking
                  ? 13
                  : 19,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        <motion.circle
          cx="200"
          cy="200"
          r="60"
          fill="none"
          stroke={`${C.amber}${isOffline ? "12" : "56"}`}
          strokeWidth="0.9"
          strokeDasharray="4 7"
          animate={{
            rotate: -360,
          }}
          transition={{
            duration:
              isExecuting
                ? 6
                : isThinking
                  ? 9
                  : 12,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        />

        {/* ======================================================== */}
        {/* IRIS GEOMETRY                                            */}
        {/* ======================================================== */}

        <motion.g
          animate={{
            rotate: -360,
          }}
          transition={{
            duration:
              isExecuting
                ? 10
                : isThinking
                  ? 15
                  : 23,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            transformOrigin: "200px 200px",
          }}
        >
          <path
            d="
              M 200 148
              L 215 174
              L 245 182
              L 226 200
              L 229 228
              L 200 214
              L 171 228
              L 174 200
              L 155 182
              L 185 174
              Z
            "
            fill="none"
            stroke={`${C.fire}${isOffline ? "15" : "72"}`}
            strokeWidth="1"
          />

          <circle
            cx="200"
            cy="200"
            r="43"
            fill="none"
            stroke={`${C.amber}${isOffline ? "12" : "52"}`}
            strokeWidth="0.9"
            strokeDasharray="2 5"
          />
        </motion.g>

        {/* ======================================================== */}
        {/* RADIAL ENERGY NODES                                     */}
        {/* ======================================================== */}

        {Array.from({
          length: NODES,
        }).map((_, index) => {
          const point = polarPoint(
            200,
            200,
            104,
            index * 30,
          );

          const major = index % 3 === 0;

          return (
            <motion.circle
              key={`node-${index}`}
              cx={point.x}
              cy={point.y}
              r={major ? 3 : 1.8}
              fill={
                major
                  ? C.amber
                  : C.fire
              }
              animate={{
                opacity: isOffline
                  ? 0.1
                  : isError
                    ? [0.15, 1, 0.15]
                    : [
                        0.16,
                        major
                          ? 0.9 * intensity
                          : 0.55 * intensity,
                        0.16,
                      ],
                scale: isOffline
                  ? 1
                  : [
                      0.88,
                      major ? 1.18 : 1.08,
                      0.88,
                    ],
              }}
              transition={{
                duration: isError
                  ? 0.55
                  : major
                    ? isExecuting
                      ? 0.65
                      : 1.7
                    : isExecuting
                      ? 0.9
                      : 2.5,
                repeat: Infinity,
                delay: index * 0.1,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {/* ======================================================== */}
        {/* EYE / CORE CONTAINMENT                                  */}
        {/* ======================================================== */}

        <circle
          cx="200"
          cy="200"
          r="40"
          fill={`${C.crimson}${isOffline ? "04" : "12"}`}
          stroke={`${C.fire}${isOffline ? "18" : "62"}`}
          strokeWidth="1"
        />

        <motion.ellipse
          cx="200"
          cy="200"
          rx="28"
          ry="16"
          fill={`${C.fire}${isOffline ? "04" : "14"}`}
          stroke={`${C.amber}${isOffline ? "20" : "B0"}`}
          strokeWidth="1.4"
          animate={{
            rx: isListening
              ? [27, 33, 27]
              : isThinking
                ? [25, 31, 25]
                : isExecuting
                  ? [23, 34, 23]
                  : [27, 29, 27],

            ry: isListening
              ? [15, 18, 15]
              : isThinking
                ? [13, 18, 13]
                : isExecuting
                  ? [12, 19, 12]
                  : [15, 16, 15],

            opacity: isOffline
              ? [0.15, 0.22, 0.15]
              : isError
                ? [0.4, 1, 0.4]
                : [0.48, 0.95, 0.48],
          }}
          transition={{
            duration: isError
              ? 0.6
              : corePulseDuration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* ======================================================== */}
        {/* WHITE-HOT PUPIL                                         */}
        {/* ======================================================== */}

        <motion.circle
          cx="200"
          cy="200"
          r="10"
          fill={
            isError
              ? "#FFE6E0"
              : C.white
          }
          animate={{
            r:
              isExecuting
                ? [8, 14, 8]
                : isThinking
                  ? [8, 13, 8]
                  : isSpeaking
                    ? [9, 13, 9]
                    : [9, 11, 9],

            opacity: isOffline
              ? [0.15, 0.25, 0.15]
              : isError
                ? [0.5, 1, 0.5]
                : [0.68, 1, 0.68],
          }}
          transition={{
            duration: isError
              ? 0.55
              : corePulseDuration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            filter: `
              drop-shadow(0 0 5px ${C.white})
              drop-shadow(0 0 11px ${C.amber})
              drop-shadow(0 0 22px ${primaryGlow})
            `,
          }}
        />

        {/* ======================================================== */}
        {/* STATE-DRIVEN ENERGY SWEEP                               */}
        {/* ======================================================== */}

        <motion.path
          d={arcPath(
            200,
            200,
            175,
            8,
            52,
          )}
          fill="none"
          stroke={
            isError
              ? C.crimson
              : activeAccent
          }
          strokeWidth={
            isExecuting
              ? 3.2
              : isThinking
                ? 2.8
                : 2.2
          }
          strokeLinecap="round"
          animate={{
            pathLength:
              isListening
                ? [0.2, 1, 0.2]
                : isThinking
                  ? [0.05, 1, 0.05]
                  : isExecuting
                    ? [0.15, 1, 0.15]
                    : [0.18, 0.5, 0.18],

            opacity: isOffline
              ? [0.05, 0.08, 0.05]
              : isError
                ? [0.2, 1, 0.2]
                : [
                    0.18 * intensity,
                    0.95 * intensity,
                    0.18 * intensity,
                  ],
          }}
          transition={{
            duration: isError
              ? 0.55
              : isExecuting
                ? 0.8
                : isThinking
                  ? 1.3
                  : isListening
                    ? 1.8
                    : 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.path
          d={arcPath(
            200,
            200,
            138,
            190,
            242,
          )}
          fill="none"
          stroke={
            isError
              ? C.crimson
              : C.fire
          }
          strokeWidth="1.8"
          strokeLinecap="round"
          animate={{
            opacity: isOffline
              ? 0.06
              : [
                  0.1 * intensity,
                  0.72 * intensity,
                  0.1 * intensity,
                ],
            pathLength:
              isExecuting
                ? [0.1, 1, 0.1]
                : isThinking
                  ? [0.2, 0.8, 0.2]
                  : [0.25, 0.65, 0.25],
          }}
          transition={{
            duration: isExecuting
              ? 0.9
              : isThinking
                ? 1.5
                : 3.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.7,
          }}
        />
      </svg>

      {/* ============================================================ */}
      {/* LOCALIZED CORE BLOOM                                       */}
      {/* ============================================================ */}

      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[16%] w-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `
            radial-gradient(
              circle,
              ${C.white}7A 0%,
              ${C.amber}48 24%,
              ${primaryGlow}2A 52%,
              transparent 100%
            )
          `,
          filter: "blur(5px)",
        }}
        animate={{
          scale: isExecuting
            ? [0.82, 1.22, 0.82]
            : isThinking
              ? [0.88, 1.15, 0.88]
              : isSpeaking
                ? [0.9, 1.12, 0.9]
                : [0.94, 1.06, 0.94],

          opacity: isOffline
            ? [0.05, 0.08, 0.05]
            : isError
              ? [0.2, 0.9, 0.2]
              : [0.28 * intensity, 0.72 * intensity, 0.28 * intensity],
        }}
        transition={{
          duration: isError
            ? 0.6
            : corePulseDuration * 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}