import { cn } from "@/lib/utils";

export type StatusTone = "ok" | "warn" | "error" | "idle" | "info" | "checking";

const TONE_COLORS: Record<StatusTone, string> = {
  ok: "var(--jarvis-success)",
  warn: "var(--jarvis-warning)",
  error: "var(--jarvis-red-bright)",
  idle: "var(--jarvis-text-disabled)",
  info: "var(--jarvis-info)",
  checking: "var(--jarvis-text-muted)",
};

interface StatusDotProps {
  tone: StatusTone;
  /** Adds a quiet pulse only while a real check is in flight. */
  pulse?: boolean;
  size?: number;
  className?: string;
}

/**
 * The single status indicator used across the HUD, sidebar and dashboard.
 * A dot always carries a text label next to it; it is never the only signal.
 */
export default function StatusDot({
  tone,
  pulse = false,
  size = 6,
  className,
}: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full", pulse && "animate-pulse", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: TONE_COLORS[tone],
        boxShadow: tone === "ok" || tone === "error" ? `0 0 6px ${TONE_COLORS[tone]}66` : "none",
      }}
    />
  );
}
