"use client";

import { parseMessageSegments } from "@/lib/ai/links";

/**
 * Renders assistant text without injecting HTML.
 *
 * Citations arrive as `[Title](https://…)` (or a bare URL) and become real
 * anchors with `noopener noreferrer nofollow`. Everything else is escaped by
 * React as ordinary text.
 */

export const LINK_CLASS =
  "break-all text-jarvis-red-bright underline decoration-jarvis-red/40 underline-offset-2 hover:text-white";

function renderEmphasis(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${keyPrefix}-${index}`}
          className="rounded bg-jarvis-red/10 px-1 py-0.5 font-mono text-[0.9em] text-jarvis-red-bright"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  parseMessageSegments(text).forEach((segment, index) => {
    if (segment.type === "link") {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${index}`}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={LINK_CLASS}
        >
          {segment.text}
        </a>
      );
      return;
    }
    nodes.push(...renderEmphasis(segment.text, `${keyPrefix}-text-${index}`));
  });
  return nodes;
}

export default function MessageText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, index) => {
        if (!line.trim()) {
          return <span key={index} className="block h-2" />;
        }

        const bullet = line.match(/^\s*[•\-*]\s+(.*)$/);
        if (bullet) {
          return (
            <span key={index} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-jarvis-red/70" />
              <span>{renderInline(bullet[1], `b${index}`)}</span>
            </span>
          );
        }

        return (
          <span key={index} className={index > 0 ? "mt-1.5 block" : "block"}>
            {renderInline(line, `l${index}`)}
          </span>
        );
      })}
    </>
  );
}
