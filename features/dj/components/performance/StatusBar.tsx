"use client";

import type { BridgeState } from "@/features/dj/bridge";
import { audioInterfaceLabel } from "@/features/dj/system";

interface StatusBarProps {
  bridgeState: BridgeState;
  bridgeOnline: boolean;
  hasSpotifyLaunch: boolean;
  libraryCount: number;
}

/**
 * Bottom status strip.
 *
 * Each cell states what is known and marks anything unmeasurable as
 * UNVERIFIED. No latency figure, audio device or controller is invented.
 */
export default function StatusBar({
  bridgeState,
  bridgeOnline,
  hasSpotifyLaunch,
  libraryCount,
}: StatusBarProps) {
  const audio = audioInterfaceLabel(bridgeOnline);

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-jarvis-red/12 bg-jarvis-bg-primary/70 px-2.5 py-1">
      <Cell
        label="SYSTEM"
        value={bridgeOnline ? "REKORDBOX · BRIDGED" : "REKORDBOX · UNVERIFIED"}
        tone={bridgeOnline ? "ok" : "muted"}
      />
      <Divider />
      <Cell
        label="SPOTIFY FREE"
        value={hasSpotifyLaunch ? "HANDOFF READY" : "READY"}
        tone="muted"
        title="Spotify Free runs separately in Brave. It is not routed into Rekordbox."
      />
      <Divider />
      <Cell
        label="AUDIO I/O"
        value={audio.value}
        tone={audio.verified ? "ok" : "warn"}
        title={audio.detail}
      />
      <Divider />
      <Cell
        label="LATENCY"
        value="—"
        tone="muted"
        title="A browser cannot measure the audio interface latency of another application."
      />
      <Divider />
      <Cell
        label="CONTROLLER"
        value="NOT CONNECTED"
        tone="warn"
        title="Controller support is a later phase. Nothing here claims hardware support."
      />
      <Divider />
      <Cell label="LIBRARY" value={`${libraryCount} TRACKS`} tone="muted" />
      <Divider />
      <Cell
        label="BRIDGE"
        value={bridgeState.toUpperCase()}
        tone={bridgeOnline ? "ok" : bridgeState === "checking" ? "muted" : "warn"}
      />
    </footer>
  );
}

function Cell({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
  title?: string;
}) {
  const valueClass =
    tone === "ok"
      ? "text-jarvis-success"
      : tone === "warn"
        ? "text-jarvis-warning"
        : "text-jarvis-text-muted";

  return (
    <span className="flex items-center gap-1 whitespace-nowrap" title={title}>
      <span className="text-[6.5px] tracking-[0.14em] text-jarvis-text-disabled uppercase">
        {label}:
      </span>
      <span className={`text-[6.5px] tracking-[0.1em] uppercase ${valueClass}`}>
        {value}
      </span>
    </span>
  );
}

function Divider() {
  return <span className="hidden h-2.5 w-px bg-jarvis-red/15 sm:block" />;
}
