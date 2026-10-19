"use client";

import { useAppStore } from "@/lib/store";

interface SessionLogProps {
  hasLibrary: boolean;
  bridgeOnline: boolean;
}

/**
 * Session checklist built from measured state only.
 * A box is ticked when the condition is verifiably true right now.
 */
export default function SessionLog({ hasLibrary, bridgeOnline }: SessionLogProps) {
  const activity = useAppStore((s) => s.activity);

  const checks = [
    {
      label: "Track library checked",
      done: hasLibrary,
      detail: hasLibrary ? "collection parsed" : "no collection imported",
    },
    {
      label: "Local bridge checked",
      done: true,
      detail: bridgeOnline ? "bridge answering" : "no bridge on 127.0.0.1:7420",
    },
    {
      label: "Rekordbox launch armed",
      done: bridgeOnline,
      detail: bridgeOnline ? "launch allowed" : "needs bridge",
    },
    {
      label: "Decks monitored",
      done: false,
      detail: "no audio engine",
    },
    {
      label: "Output monitor",
      done: false,
      detail: "not readable from browser",
    },
  ];

  const lines = activity.slice(0, 4);

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-jarvis-red/12 bg-jarvis-surface/55 p-2.5">
      <h3 className="text-[8px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
        Session log
      </h3>

      <ul className="mt-1.5 space-y-[3px]">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-1.5">
            <span
              className={`mt-[2px] flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-[2px] border text-[7px] leading-none ${
                check.done
                  ? "border-jarvis-success/40 bg-jarvis-success/15 text-jarvis-success"
                  : "border-jarvis-text-disabled/25 text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[7.5px] ${
                  check.done ? "text-jarvis-text-muted" : "text-jarvis-text-disabled"
                }`}
              >
                {check.label}
              </span>
              <span className="block truncate text-[6.5px] text-jarvis-text-disabled/70">
                {check.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {lines.length > 0 && (
        <div className="mt-2 min-h-0 flex-1 border-t border-jarvis-red/10 pt-1.5">
          <p className="text-[6.5px] tracking-[0.16em] text-jarvis-text-disabled uppercase">
            Recent activity
          </p>
          <ul className="mt-1 space-y-[2px]">
            {lines.map((line) => (
              <li
                key={line.id}
                className="truncate font-mono text-[6.5px] leading-snug text-jarvis-text-disabled/80"
                title={line.event}
              >
                {line.event}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
