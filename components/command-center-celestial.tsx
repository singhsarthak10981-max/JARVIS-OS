"use client";

import { motion } from "framer-motion";

type Star = {
  left: string;
  top: string;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
};

const FAR_STARS: Star[] = [
  { left: "5%", top: "12%", size: 1, opacity: 0.2, duration: 11, delay: 0 },
  { left: "12%", top: "25%", size: 1, opacity: 0.16, duration: 14, delay: 2 },
  { left: "20%", top: "8%", size: 1, opacity: 0.22, duration: 9, delay: 4 },
  { left: "29%", top: "18%", size: 1, opacity: 0.17, duration: 13, delay: 1 },
  { left: "37%", top: "11%", size: 1, opacity: 0.2, duration: 10, delay: 5 },
  { left: "46%", top: "22%", size: 1, opacity: 0.15, duration: 15, delay: 3 },
  { left: "55%", top: "9%", size: 1, opacity: 0.19, duration: 12, delay: 6 },
  { left: "64%", top: "17%", size: 1, opacity: 0.16, duration: 10, delay: 1 },
  { left: "74%", top: "10%", size: 1, opacity: 0.21, duration: 14, delay: 4 },
  { left: "86%", top: "20%", size: 1, opacity: 0.17, duration: 11, delay: 2 },
  { left: "94%", top: "12%", size: 1, opacity: 0.15, duration: 13, delay: 5 },

  { left: "7%", top: "42%", size: 1, opacity: 0.14, duration: 12, delay: 3 },
  { left: "17%", top: "55%", size: 1, opacity: 0.18, duration: 15, delay: 1 },
  { left: "27%", top: "47%", size: 1, opacity: 0.15, duration: 10, delay: 4 },
  { left: "40%", top: "58%", size: 1, opacity: 0.17, duration: 13, delay: 2 },
  { left: "52%", top: "44%", size: 1, opacity: 0.15, duration: 11, delay: 6 },
  { left: "63%", top: "61%", size: 1, opacity: 0.18, duration: 14, delay: 0 },
  { left: "75%", top: "51%", size: 1, opacity: 0.14, duration: 12, delay: 3 },
  { left: "89%", top: "60%", size: 1, opacity: 0.16, duration: 15, delay: 5 },

  { left: "10%", top: "78%", size: 1, opacity: 0.15, duration: 13, delay: 2 },
  { left: "23%", top: "89%", size: 1, opacity: 0.13, duration: 11, delay: 5 },
  { left: "36%", top: "75%", size: 1, opacity: 0.17, duration: 14, delay: 1 },
  { left: "49%", top: "91%", size: 1, opacity: 0.14, duration: 12, delay: 4 },
  { left: "62%", top: "82%", size: 1, opacity: 0.16, duration: 15, delay: 0 },
  { left: "77%", top: "91%", size: 1, opacity: 0.13, duration: 10, delay: 6 },
  { left: "91%", top: "80%", size: 1, opacity: 0.15, duration: 13, delay: 2 },
];

const MID_STARS: Star[] = [
  { left: "9%", top: "18%", size: 1.5, opacity: 0.38, duration: 8, delay: 1 },
  { left: "23%", top: "31%", size: 2, opacity: 0.3, duration: 10, delay: 3 },
  { left: "35%", top: "15%", size: 1.5, opacity: 0.34, duration: 7, delay: 5 },
  { left: "49%", top: "28%", size: 2, opacity: 0.28, duration: 11, delay: 2 },
  { left: "61%", top: "13%", size: 1.5, opacity: 0.33, duration: 9, delay: 4 },
  { left: "78%", top: "26%", size: 2, opacity: 0.3, duration: 12, delay: 1 },
  { left: "91%", top: "34%", size: 1.5, opacity: 0.32, duration: 8, delay: 6 },

  { left: "14%", top: "66%", size: 2, opacity: 0.28, duration: 11, delay: 3 },
  { left: "32%", top: "57%", size: 1.5, opacity: 0.31, duration: 9, delay: 0 },
  { left: "47%", top: "72%", size: 2, opacity: 0.26, duration: 12, delay: 4 },
  { left: "69%", top: "63%", size: 1.5, opacity: 0.3, duration: 8, delay: 2 },
  { left: "84%", top: "74%", size: 2, opacity: 0.27, duration: 10, delay: 5 },
];

function StarField({
  stars,
  driftX,
  driftY,
  scale,
}: {
  stars: Star[];
  driftX: number;
  driftY: number;
  scale: number;
}) {
  return (
    <motion.div
      className="absolute inset-[-4%]"
      animate={{
        x: [0, driftX, 0],
        y: [0, driftY, 0],
        scale: [1, scale, 1],
      }}
      transition={{
        duration: 55,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {stars.map((star, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
          }}
          animate={{
            opacity: [
              star.opacity * 0.55,
              star.opacity,
              star.opacity * 0.65,
              star.opacity,
            ],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

export default function CommandCenterCelestial() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      aria-hidden="true"
    >
      {/* ============================================================ */}
      {/* FAR SPACE — extremely slow                                   */}
      {/* ============================================================ */}

      <StarField
        stars={FAR_STARS}
        driftX={2}
        driftY={-1}
        scale={1.002}
      />

      {/* ============================================================ */}
      {/* MID SPACE — slightly more alive                              */}
      {/* ============================================================ */}

      <StarField
        stars={MID_STARS}
        driftX={5}
        driftY={-2}
        scale={1.008}
      />

      {/* ============================================================ */}
      {/* OCCASIONAL FOREGROUND STREAK                                 */}
      {/* ============================================================ */}

      <motion.div
        className="absolute left-[68%] top-[24%] h-[1px] w-24 origin-left rotate-[22deg] rounded-full bg-gradient-to-r from-transparent via-white/65 to-transparent"
        animate={{
          x: ["0vw", "32vw"],
          y: ["0vh", "14vh"],
          opacity: [0, 0, 0.8, 0],
          scaleX: [0.5, 1, 1.2, 0.8],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          repeatDelay: 18,
          ease: "easeOut",
          times: [0, 0.62, 0.76, 1],
        }}
      />

      <motion.div
        className="absolute left-[20%] top-[67%] h-[1px] w-20 origin-left rotate-[-17deg] rounded-full bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent"
        animate={{
          x: ["0vw", "35vw"],
          y: ["0vh", "-12vh"],
          opacity: [0, 0, 0.7, 0],
          scaleX: [0.5, 1, 1.15, 0.7],
        }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          repeatDelay: 27,
          ease: "easeOut",
          times: [0, 0.65, 0.78, 1],
          delay: 8,
        }}
      />

      {/* ============================================================ */}
      {/* RARE ATMOSPHERIC LIGHT                                      */}
      {/* ============================================================ */}

      <motion.div
        className="absolute left-[52%] top-[18%] h-24 w-24 rounded-full bg-cyan-100/[0.02] blur-2xl"
        animate={{
          opacity: [0.15, 0.35, 0.15],
          x: [0, 12, 0],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}