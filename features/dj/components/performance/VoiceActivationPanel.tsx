"use client";

import { useAppStore } from "@/lib/store";
import { useJarvis } from "@/components/assistant/JarvisProvider";
import { useDjBridge } from "@/features/dj/hooks/useDjBridge";

/**
 * Voice activation for the performance surface.
 *
 * Wired to the real Web Speech recogniser through JarvisProvider. The command
 * list shows only phrases that resolve to something JARVIS can actually do on
 * this machine right now — launch requests are marked as bridge-dependent
 * instead of implying they always work.
 */
export default function VoiceActivationPanel() {
  const { listening, transcript, startListening, stopListening, recognitionSupported } =
    useJarvis();
  const aiState = useAppStore((s) => s.aiState);
  const { status } = useDjBridge();
  const bridgeOnline = status.state === "online";

  const commands = [
    { phrase: "Hey JARVIS, open performance view", works: true },
    { phrase: "Hey JARVIS, exit performance view", works: true },
    { phrase: "Hey JARVIS, recommend energy 126", works: true },
    { phrase: "Hey JARVIS, open DJ mode", works: true },
    { phrase: "Hey JARVIS, launch Rekordbox", works: bridgeOnline },
  ];

  return (
    <section className="flex flex-col rounded-lg border border-jarvis-red/12 bg-jarvis-surface/55 p-2.5">
      <header className="flex items-center justify-between">
        <h3 className="text-[8px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
          Voice activation
        </h3>
        <span className="flex items-center gap-1 text-[7px] tracking-wider text-jarvis-text-disabled uppercase">
          <span
            className={`h-1 w-1 rounded-full ${
              listening ? "animate-pulse bg-jarvis-success" : "bg-jarvis-text-disabled/50"
            }`}
          />
          {listening ? "LIVE" : aiState.toUpperCase()}
        </span>
      </header>

      <button
        type="button"
        onClick={() => (listening ? stopListening() : startListening())}
        disabled={!recognitionSupported}
        aria-pressed={listening}
        className={`group relative mt-2.5 flex h-16 shrink-0 flex-col items-center justify-center rounded-lg border transition-colors lg:h-20 ${
          listening
            ? "border-jarvis-success/40 bg-jarvis-success/5"
            : "border-jarvis-red/20 bg-jarvis-bg-primary/50 hover:border-jarvis-red/40"
        } disabled:cursor-not-allowed disabled:opacity-50`}
        title={
          recognitionSupported
            ? "Start or stop voice recognition"
            : "Speech recognition is not available in this browser"
        }
      >
        <span
          className={`relative flex h-9 w-9 items-center justify-center rounded-full border lg:h-11 lg:w-11 ${
            listening
              ? "border-jarvis-success/50 bg-jarvis-success/10"
              : "border-jarvis-red/35 bg-jarvis-red/10"
          }`}
        >
          {listening && (
            <span className="absolute inset-0 animate-ping rounded-full border border-jarvis-success/40" />
          )}
          <span
            className={`text-[12px] lg:text-[14px] ${
              listening ? "text-jarvis-success" : "text-jarvis-red"
            }`}
          >
            ◉
          </span>
        </span>
        <span className="mt-1.5 text-[7.5px] tracking-[0.18em] text-jarvis-text-muted uppercase">
          {recognitionSupported
            ? listening
              ? "Listening — speak now"
              : "Tap to speak"
            : "Recognition unavailable"}
        </span>
      </button>

      <p className="mt-1.5 min-h-[14px] truncate font-mono text-[7.5px] text-jarvis-text-disabled">
        {transcript ? `› ${transcript}` : recognitionSupported ? "› awaiting wake phrase" : "›"}
      </p>

      <ul className="mt-1.5 space-y-1 border-t border-jarvis-red/10 pt-1.5">
        {commands.map((command) => (
          <li key={command.phrase} className="flex items-start gap-1">
            <span
              className={`mt-[3px] h-1 w-1 shrink-0 rounded-full ${
                command.works ? "bg-jarvis-success/70" : "bg-jarvis-warning/70"
              }`}
            />
            <span className="text-[7px] leading-snug text-jarvis-text-muted">
              “{command.phrase}”
              {!command.works && (
                <span className="text-jarvis-warning/80"> · needs bridge</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {!recognitionSupported && (
        <p className="mt-1.5 rounded border border-jarvis-warning/20 bg-jarvis-warning/5 px-1.5 py-1 text-[7px] leading-snug text-jarvis-warning/90">
          This browser has no SpeechRecognition. Typed commands still work —
          open the assistant with ⌘/Ctrl+Shift+J.
        </p>
      )}
    </section>
  );
}
