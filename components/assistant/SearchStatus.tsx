"use client";

import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/ai/links";
import type { SearchNotice } from "@/lib/ai/search/types";

/**
 * Per-message web search state.
 *
 * Deliberately explicit: the user can always tell whether an answer was
 * sourced, whether official sources were requested, whether a third-party
 * fallback was used, and why a search was unavailable.
 */

const HEADINGS: Record<SearchNotice["status"], string> = {
  searching: "Searching the web",
  complete: "Live web",
  "official-complete": "Official sources",
  "official-fallback": "Official + secondary",
  "official-insufficient": "Official evidence insufficient",
  "official-unverified": "Official source not identified",
  empty: "No sources found",
  unavailable: "Web search unavailable",
  disabled: "Web search off",
  error: "Web search failed",
};

const TONES: Record<SearchNotice["status"], "active" | "ok" | "warn"> = {
  searching: "active",
  complete: "ok",
  "official-complete": "ok",
  "official-fallback": "ok",
  "official-insufficient": "warn",
  "official-unverified": "warn",
  empty: "warn",
  unavailable: "warn",
  disabled: "warn",
  error: "warn",
};

const SOURCED: SearchNotice["status"][] = [
  "complete",
  "official-complete",
  "official-fallback",
];

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
  const officialCount = sources.filter((source) => source.official).length;
  const secondaryCount = sources.length - officialCount;
  const isOfficialMode = notice.mode === "official";
  // Insufficient evidence can still surface real first-party links alongside
  // third-party ones, so it counts them like any other sourced status.
  const counted =
    SOURCED.includes(notice.status) ||
    (notice.status === "official-insufficient" && sources.length > 0);

  let heading: string;
  if (notice.status === "searching") {
    heading = isOfficialMode ? "Searching official sources" : HEADINGS.searching;
  } else if (SOURCED.includes(notice.status)) {
    heading = `${HEADINGS[notice.status]} · ${sources.length} source${
      sources.length === 1 ? "" : "s"
    }`;
    if (isOfficialMode && officialCount > 0) {
      heading += ` (${officialCount} official)`;
    }
  } else if (notice.status === "official-insufficient" && sources.length > 0) {
    heading = `${HEADINGS[notice.status]} · ${sources.length} source${
      sources.length === 1 ? "" : "s"
    }`;
    if (officialCount > 0) {
      heading += ` (${officialCount} official${
        secondaryCount > 0 ? `, ${secondaryCount} secondary` : ""
      })`;
    }
  } else {
    heading = HEADINGS[notice.status];
  }

  return (
    <div
      data-testid="search-status"
      data-status={notice.status}
      data-mode={notice.mode ?? "web"}
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
        {notice.query && !counted && (
          <span className="truncate text-jarvis-text-disabled normal-case">
            · {notice.query}
          </span>
        )}
      </div>

      {isOfficialMode && notice.vendor && (
        <p className="mt-0.5 text-[8.5px] tracking-wide text-jarvis-text-disabled uppercase">
          First-party: {notice.vendor}
          {notice.domains && notice.domains.length > 0
            ? ` · ${notice.domains.join(", ")}`
            : ""}
        </p>
      )}

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
            const isOfficial = source.official === true;
            return (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  title={
                    isOfficial
                      ? `Official source: ${source.title}`
                      : source.title
                  }
                  data-official={isOfficial ? "true" : "false"}
                  className={cn(
                    "inline-block max-w-[220px] truncate rounded border px-1.5 py-0.5 text-[8.5px] transition-colors hover:text-white",
                    isOfficial
                      ? "border-jarvis-success/40 bg-jarvis-success/10 text-jarvis-success"
                      : "border-jarvis-red/20 bg-jarvis-bg-primary/50 text-jarvis-red-bright hover:border-jarvis-red/40"
                  )}
                >
                  {isOfficial && <span aria-hidden>✓ </span>}
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
