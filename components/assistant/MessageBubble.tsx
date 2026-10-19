"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/types";

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-jarvis-red/10 px-1 py-0.5 font-mono text-[0.9em] text-jarvis-red-bright"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function formatBody(text: string): React.ReactNode {
  return text.split("\n").map((line, index) => {
    if (!line.trim()) return <span key={index} className="block h-2" />;
    const bullet = line.match(/^\s*[•\-*]\s+(.*)$/);
    if (bullet) {
      return (
        <span key={index} className="flex gap-2">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-jarvis-red/70" />
          <span>{renderInline(bullet[1])}</span>
        </span>
      );
    }
    return (
      <span key={index} className={index > 0 ? "mt-1.5 block" : "block"}>
        {renderInline(line)}
      </span>
    );
  });
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubbleInner({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-jarvis-red/25 bg-jarvis-red/10 px-3.5 py-2.5">
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-white">
            {message.text}
          </p>
          <div className="mt-1 text-right text-[8px] tracking-wider text-jarvis-text-disabled">
            {time}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex gap-2.5"
    >
      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-jarvis-red/30 bg-jarvis-red/10">
        <span className="h-1.5 w-1.5 rounded-full bg-jarvis-red shadow-[0_0_6px_rgba(229,0,0,0.7)]" />
      </div>

      <div className="min-w-0 max-w-[88%]">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-[8.5px] font-semibold tracking-[0.22em] text-jarvis-red/80 uppercase">
            J.A.R.V.I.S.
          </span>
          {message.provider && (
            <span className="truncate text-[8px] tracking-wider text-jarvis-text-disabled/70 uppercase">
              {message.provider}
            </span>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-[12.5px] leading-relaxed",
            message.error
              ? "border-jarvis-warning/30 bg-jarvis-warning/5 text-jarvis-text"
              : "border-jarvis-red/10 bg-jarvis-surface/50 text-jarvis-text"
          )}
        >
          {message.text ? (
            <div className="whitespace-pre-wrap">{formatBody(message.text)}</div>
          ) : (
            <span className="flex items-center gap-1.5 py-0.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-jarvis-red/70"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </span>
          )}

          {message.streaming && message.text && (
            <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-jarvis-red align-middle" />
          )}
        </div>

        <div className="mt-1 flex items-center gap-2 text-[8px] tracking-wider text-jarvis-text-disabled/60">
          <span>{time}</span>
          {message.error && (
            <span className="text-jarvis-warning/80">DEGRADED UPLINK</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const MessageBubble = memo(MessageBubbleInner);
export default MessageBubble;
