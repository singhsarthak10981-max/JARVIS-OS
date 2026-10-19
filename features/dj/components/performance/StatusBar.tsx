"use client";

import type { BridgeState } from "@/features/dj/bridge";
import {
  audioInterfaceLabel,
  runtimeLabel,
  type RekordboxRuntime,
} from "@/features/dj/system";

interface StatusBarProps {
  bridgeState: BridgeState;
  bridgeOnline: boolean;
  /** Only ever "unknown" unless a bridge explicitly reported the process. */
  rekordboxRuntime: RekordboxRuntime;
  libraryCount: number;
  assignedDecks: number;
}

/**
 * Bottom status strip.
 *
 * Each cell states what is known and marks anything unmeasurable as
 * UNVERIFIED / UNKNOWN. No latency figure, audio device, controller or
 * running-state is invented.
 */
export default function StatusBar({
  bridgeState,
  bridgeOnline,
  rekordboxRuntime,
  libraryCount,
  assignedDecks,
}: StatusBarProps) {
  const audio = audioInterfaceLabel(bridgeOnline);

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-jarvis-red/12 bg-jarvis-bg-primary/70 px-2.5 py-1">
      <Cell
        label="REKORDBOX"
        value={runtimeLabel(rekordboxRuntime)}
        tone={rekordboxRuntime === "unknown" ? "warn" : "ok"}
        title={
          rekordboxRuntime === "unknown"
            ? "A browser cannot see whether Rekordbox is running. A launch request does not prove the process started; this stays UNKNOWN until the bridge reports it."
            : "Reported by the local bridge."
        }
      />
      <Divider />
      <Cell
        label="SPOTIFY FREE"
        value="HANDOFF READY"
        tone="muted"
        title="Opens the Spotify web player in Brave. Separate app — never routed into Rekordbox."
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
      <Cell
        label="DECKS"
        value={`${assignedDecks} ASSIGNED`}
        tone="muted"
        title="Assignments are stored locally as track ids. Transport is still owned by Rekordbox."
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
