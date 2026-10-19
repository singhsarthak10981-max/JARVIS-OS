"use client";

import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/ai/links";
import type { SearchNotice } from "@/lib/ai/search/types";

/**
 * Per-message web search state.
 *
 * Deliberately explicit: the user can always tell whether an answer was
 * sourced, whether search was skipped, and why it was unavailable.
 */

const HEADINGS: Record<SearchNotice["status"], string> = {
  searching: "Searching the web",
  complete: "Live web",
  empty: "No sources found",
  unavailable: "Web search unavailable",
  disabled: "Web search off",
  error: "Web search failed",
};

const TONES: Record<SearchNotice["status"], "active" | "ok" | "warn"> = {
  searching: "active",
  complete: "ok",
  empty: "warn",
  unavailable: "warn",
  disabled: "warn",
  error: "warn",
};

function hostnameOf(url: string): string {
  const href = safeHref(url);
  if (!href) return "source";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export default function SearchStatus({ notice }: { notice: SearchNotice }) {
  const tone = TONES[notice.status];
  const sources = notice.sources ?? [];
  const heading =
    notice.status === "complete"
      ? `${HEADINGS.complete} · ${sources.length} source${sources.length === 1 ? "" : "s"}`
      : HEADINGS[notice.status];

  return (
    <div
      data-testid="search-status"
      data-status={notice.status}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-[9px] leading-relaxed",
        tone === "active" && "border-jarvis-red/25 bg-jarvis-red/5 text-jarvis-red/90",
        tone === "ok" && "border-jarvis-success/25 bg-jarvis-success/5 text-jarvis-success/90",
        tone === "warn" && "border-jarvis-warning/25 bg-jarvis-warning/5 text-jarvis-warning/90"
      )}
    >
      <div className="flex items-center gap-1.5">
        {tone === "active" && (
          <span className="h-1 w-1 animate-pulse rounded-full bg-jarvis-red" />
        )}
        <span className="tracking-[0.16em] uppercase">{heading}</span>
        {notice.query && notice.status !== "complete" && (
          <span className="truncate text-jarvis-text-disabled normal-case">
            · {notice.query}
          </span>
        )}
      </div>

      {notice.message && (
        <p className="mt-1 text-[9px] normal-case text-jarvis-text-muted">
          {notice.message}
        </p>
      )}

      {sources.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {sources.map((source) => {
            const href = safeHref(source.url);
            if (!href) return null;
            return (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  title={source.title}
                  className="inline-block max-w-[220px] truncate rounded border border-jarvis-red/20 bg-jarvis-bg-primary/50 px-1.5 py-0.5 text-[8.5px] text-jarvis-red-bright transition-colors hover:border-jarvis-red/40 hover:text-white"
                >
                  {hostnameOf(href)}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
