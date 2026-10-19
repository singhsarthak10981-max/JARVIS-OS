"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Real waveform analysis of a local audio file.
 *
 * The user picks a file they already own; the browser decodes it with the Web
 * Audio API and reduces it to a peak envelope for drawing. Nothing is uploaded,
 * nothing is recorded, and no stream is captured — this is a local decode of a
 * local file.
 *
 * If `decodeAudioData` is unavailable (older browsers, jsdom in tests) the hook
 * reports `unsupported` and the deck shows an honest empty state.
 */

export const MAX_ANALYSIS_BYTES = 40 * 1024 * 1024;

export type PeakState =
  | { status: "idle" }
  | { status: "analyzing"; fileName: string }
  | { status: "ready"; fileName: string; peaks: number[]; durationSec: number }
  | { status: "error"; message: string };

function supportsDecoding(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.AudioContext !== "undefined" &&
    typeof window.AudioContext.prototype.decodeAudioData === "function"
  );
}

/** Reduces decoded channel data to `bars` normalised peak values (0–1). */
function toPeaks(channel: Float32Array, bars: number): number[] {
  const blockSize = Math.max(1, Math.floor(channel.length / bars));
  const peaks: number[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const start = bar * blockSize;
    const end = Math.min(start + blockSize, channel.length);
    let peak = 0;
    // Sample within the block: enough for a faithful envelope, far cheaper
    // than scanning every sample of a long track.
    const step = Math.max(1, Math.floor((end - start) / 512));
    for (let i = start; i < end; i += step) {
      const value = Math.abs(channel[i]);
      if (value > peak) peak = value;
    }
    peaks.push(peak);
  }

  const max = peaks.reduce((acc, value) => Math.max(acc, value), 0);
  return max > 0 ? peaks.map((value) => value / max) : peaks;
}

export function useAudioPeaks(bars = 160) {
  const [state, setState] = useState<PeakState>({ status: "idle" });
  const contextRef = useRef<AudioContext | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    };
  }, []);

  const analyze = useCallback(
    async (file: File) => {
      if (file.size > MAX_ANALYSIS_BYTES) {
        setState({
          status: "error",
          message: "File is larger than the 40 MB analysis limit.",
        });
        return;
      }

      if (!supportsDecoding()) {
        setState({
          status: "error",
          message: "This browser cannot decode audio locally.",
        });
        return;
      }

      setState({ status: "analyzing", fileName: file.name });

      try {
        const buffer = await file.arrayBuffer();
        const context =
          contextRef.current ?? new window.AudioContext();
        contextRef.current = context;

        const audio = await context.decodeAudioData(buffer.slice(0));
        if (!mounted.current) return;

        const peaks = toPeaks(audio.getChannelData(0), bars);
        setState({
          status: "ready",
          fileName: file.name,
          peaks,
          durationSec: audio.duration,
        });
      } catch {
        if (!mounted.current) return;
        setState({
          status: "error",
          message:
            "Could not decode that file. Supported formats depend on the browser (MP3, WAV, FLAC, OGG, M4A usually work).",
        });
      }
    },
    [bars]
  );

  const clear = useCallback(() => setState({ status: "idle" }), []);

  return { state, analyze, clear };
}
