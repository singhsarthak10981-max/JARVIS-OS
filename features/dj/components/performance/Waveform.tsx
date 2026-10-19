"use client";

import { memo } from "react";

interface WaveformProps {
  peaks: number[] | null;
  /** True while the local file is being decoded. */
  analyzing?: boolean;
  fileName?: string;
  /** Shown when there are no peaks: why the waveform is empty. */
  emptyLabel?: string;
  className?: string;
}

/**
 * Waveform from real decoded peaks, or an explicit "no data" state.
 *
 * There is deliberately no generated pattern: a drawn waveform implies audio
 * analysis, so the empty state says so plainly.
 */
function WaveformInner({
  peaks,
  analyzing = false,
  fileName,
  emptyLabel = "NO WAVEFORM DATA",
  className = "",
}: WaveformProps) {
  if (analyzing) {
    return (
      <div
        className={`flex items-center justify-center gap-2 border border-dashed border-jarvis-red/15 bg-jarvis-bg-primary/40 ${className}`}
      >
        <span className="h-1 w-1 animate-pulse rounded-full bg-jarvis-red" />
        <span className="text-[8px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
          Decoding locally…
        </span>
      </div>
    );
  }

  if (!peaks || peaks.length === 0) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden border border-dashed border-jarvis-red/12 bg-jarvis-bg-primary/40 ${className}`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-jarvis-red/20 to-transparent"
        />
        <span className="relative text-[7.5px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
          {emptyLabel}
        </span>
      </div>
    );
  }

  const width = 100;
  const height = 28;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={`Waveform of ${fileName ?? "loaded audio"}`}
      >
        {peaks.map((peak, index) => {
          const barWidth = width / peaks.length;
          const amp = Math.max(0.06, peak) * (height / 2);
          return (
            <rect
              key={index}
              x={index * barWidth}
              y={height / 2 - amp}
              width={Math.max(0.25, barWidth * 0.62)}
              height={amp * 2}
              fill={index % 2 === 0 ? "rgba(229,0,0,0.75)" : "rgba(229,0,0,0.38)"}
            />
          );
        })}
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-jarvis-bg-primary/50 via-transparent to-jarvis-bg-primary/50"
      />
    </div>
  );
}

const Waveform = memo(WaveformInner);
export default Waveform;
