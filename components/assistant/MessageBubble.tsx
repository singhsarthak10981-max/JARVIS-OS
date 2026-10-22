"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/types";
import MessageText from "./MessageText";
import SearchStatus from "./SearchStatus";

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
          {message.imagePreviews && message.imagePreviews.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {message.imagePreviews.map((src, index) => (
                // Session-only blob: previews cannot use the Next.js image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`Attached image ${index + 1}`}
                  className="h-16 w-16 rounded-lg border border-jarvis-red/20 object-cover"
                />
              ))}
            </div>
          )}
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
          {message.localOnly && (
            <span className="rounded border border-jarvis-red/25 px-1 py-px text-[7.5px] tracking-[0.18em] text-jarvis-red/80 uppercase">
              local only
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
          {message.search && (
            <div className="mb-2">
              <SearchStatus notice={message.search} />
            </div>
          )}

          {message.text ? (
            <div className="whitespace-pre-wrap">
              <MessageText text={message.text} />
            </div>
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
          {message.localOnly && (
            <span className="text-jarvis-text-disabled/60">
              NOT SAVED · NOT SENT TO A MODEL
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const MessageBubble = memo(MessageBubbleInner);
export default MessageBubble;
