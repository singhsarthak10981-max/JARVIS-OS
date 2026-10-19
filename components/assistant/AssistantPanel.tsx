"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";
import { getProviderMeta } from "@/lib/ai/providers";
import { openModuleWindow } from "@/lib/window-actions";
import { SUGGESTED_PROMPTS } from "@/lib/ai/intents";
import { loadMemories } from "@/lib/ai/memory";
import { useJarvis } from "./JarvisProvider";
import MessageBubble from "./MessageBubble";
import VoiceVisualizer from "./VoiceVisualizer";

function IconMic({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSend({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12 20 4l-3.5 16-4.5-6.5L4 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m12 13.5 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconStop({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconClose({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M10 7V5h4v2M7 7l1 13h8l1-13M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVolume({ size = 14, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10v4h3l4 4V6L7 10H4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {muted ? (
        <path d="m15 9 5 6m0-6-5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M14.5 8.5a5 5 0 0 1 0 7M17 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function AssistantPanel() {
  const open = useAppStore((s) => s.assistantOpen);
  const booted = useAppStore((s) => s.booted);
  const seed = useAppStore((s) => s.assistantSeed);
  const closeAssistant = useAppStore((s) => s.closeAssistant);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const aiState = useAppStore((s) => s.aiState);

  const {
    messages,
    isStreaming,
    listening,
    speaking,
    transcript,
    error,
    serverStatus,
    recognitionSupported,
    send,
    startListening,
    stopAll,
    clearChat,
    dismissError,
  } = useJarvis();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    if (open) setMemoryCount(loadMemories().length);
  }, [open, messages.length]);

  const mode = useMemo(() => {
    const provider = settings.aiProvider;
    if (provider === "local") {
      return {
        label: "LOCAL CORE",
        color: "var(--jarvis-red)",
        title: "Running on the built-in local intelligence core.",
      };
    }
    const meta = getProviderMeta(provider);
    // Credentials are server-side only, so "configured" is answered by the
    // server for the *selected* provider — not by whether any key exists.
    const serverConfigured = serverStatus?.providers?.[provider] ?? false;

    if (serverConfigured) {
      return {
        label: `${meta.label.toUpperCase()} · SERVER`,
        color: tokens.color.success,
        title: `Using the server-side credentials for ${meta.label}.`,
      };
    }
    // Ollama and Custom need no key, so they are never "not configured".
    if (!meta.requiresKey) {
      return {
        label: `${meta.label.toUpperCase()} · LOCAL`,
        color: tokens.color.info,
        title: settings.aiBaseUrl.trim()
          ? `Pointing at ${settings.aiBaseUrl}.`
          : `Using the default endpoint for ${meta.label}.`,
      };
    }
    return {
      label: "NOT CONFIGURED",
      color: tokens.color.warning,
      title: `${meta.label} has no server-side credentials. Add ${meta.envKeys[0] ?? "an API key"} to .env.local and restart JARVIS. Local Core stays available if you select it.`,
    };
  }, [settings.aiProvider, settings.aiBaseUrl, serverStatus]);

  const stateColor = tokens.orb.core[aiState] ?? tokens.color.textDisabled;

  // A seed means the user explicitly asked JARVIS something (palette or
  // dashboard chip) — send it immediately instead of just pre-filling.
  useEffect(() => {
    if (!open) return;
    if (seed) {
      useAppStore.setState({ assistantSeed: "" });
      void send(seed);
    }
    const timeout = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(timeout);
  }, [open, seed, send]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAssistant();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, closeAssistant]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, isStreaming, listening]);

  const submit = (value: string) => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setInput("");
    void send(text);
  };

  const stateLabel: Record<string, string> = {
    idle: "STANDBY",
    listening: "LISTENING",
    thinking: "PROCESSING",
    speaking: "SPEAKING",
    executing: "EXECUTING",
    offline: "OFFLINE",
    error: "FAULT",
  };

  return (
    <AnimatePresence>
      {open && booted && (
        <>
          <motion.div
            key="assistant-scrim"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeAssistant}
            aria-hidden
          />

          <motion.aside
            key="assistant-panel"
            role="dialog"
            aria-label="JARVIS assistant"
            aria-modal="false"
            className="fixed inset-x-0 bottom-0 z-50 flex h-[82vh] flex-col overflow-hidden rounded-t-2xl border border-jarvis-red/20 bg-jarvis-bg-secondary/95 shadow-[0_0_60px_rgba(0,0,0,0.7)] backdrop-blur-[24px] sm:inset-y-3 sm:right-3 sm:left-auto sm:h-auto sm:w-[440px] sm:rounded-2xl"
            initial={{ x: 40, opacity: 0, y: 24 }}
            animate={{ x: 0, opacity: 1, y: 0 }}
            exit={{ x: 40, opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <header className="relative flex shrink-0 items-center gap-3 border-b border-jarvis-red/10 px-4 py-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full opacity-20 blur-[6px]"
                  style={{ backgroundColor: stateColor }}
                />
                <span
                  className="relative flex h-7 w-7 items-center justify-center rounded-full border"
                  style={{ borderColor: `color-mix(in srgb, ${stateColor} 40%, transparent)` }}
                >
                  <motion.span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: stateColor }}
                    animate={{
                      scale:
                        aiState === "idle" || aiState === "offline"
                          ? [1, 1.08, 1]
                          : aiState === "listening"
                            ? [1, 1.25, 1]
                            : [1, 1.15, 1],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration:
                        aiState === "idle"
                          ? 3.5
                          : aiState === "listening"
                            ? 1
                            : 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[11px] font-semibold tracking-[0.22em] text-jarvis-red uppercase text-glow-sm">
                    J.A.R.V.I.S.
                  </h2>
                  <span className="text-[8px] tracking-[0.18em] text-jarvis-text-disabled uppercase">
                    {stateLabel[aiState] ?? "STANDBY"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openModuleWindow("settings")}
                  className="mt-0.5 flex max-w-full items-center gap-1.5 truncate text-left text-[8.5px] tracking-[0.14em] text-jarvis-text-muted uppercase transition-colors hover:text-jarvis-text-secondary"
                  title={`${mode.title} Click to open Settings.`}
                >
                  <span
                    className="h-1 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: mode.color }}
                  />
                  <span className="truncate">{mode.label}</span>
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({ voiceEnabled: !settings.voiceEnabled })
                  }
                  aria-pressed={settings.voiceEnabled}
                  title={settings.voiceEnabled ? "Mute voice replies" : "Enable voice replies"}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition-colors hover:border-jarvis-red/20 hover:bg-jarvis-red/5 ${
                    settings.voiceEnabled
                      ? "text-jarvis-red"
                      : "text-jarvis-text-disabled hover:text-jarvis-text-muted"
                  }`}
                >
                  <IconVolume muted={!settings.voiceEnabled} />
                </button>

                <button
                  type="button"
                  onClick={clearChat}
                  title="Clear conversation"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-jarvis-text-disabled transition-colors hover:border-jarvis-red/20 hover:bg-jarvis-red/5 hover:text-jarvis-red"
                >
                  <IconTrash />
                </button>

                <button
                  type="button"
                  onClick={closeAssistant}
                  title="Close (Esc)"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-jarvis-text-disabled transition-colors hover:border-jarvis-red/20 hover:bg-jarvis-red/5 hover:text-jarvis-red"
                >
                  <IconClose />
                </button>
              </div>
            </header>

            {/* Conversation */}
            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 [scrollbar-color:rgba(229,0,0,0.25)_transparent] [scrollbar-width:thin]"
            >
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {messages.length <= 1 && !isStreaming && (
                <div className="pt-2">
                  <div className="mb-2 text-[8.5px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
                    Suggested directives
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => submit(prompt)}
                        className="rounded-full border border-jarvis-red/15 bg-jarvis-surface/40 px-2.5 py-1 text-[10px] text-jarvis-text-muted transition-colors hover:border-jarvis-red/35 hover:bg-jarvis-red/10 hover:text-jarvis-text"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(listening || speaking) && (
                <VoiceVisualizer
                  mode={listening ? "listening" : "speaking"}
                  transcript={transcript}
                />
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-jarvis-red/10 bg-jarvis-bg-secondary/60 px-3 py-3">
              {error && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-jarvis-warning/25 bg-jarvis-warning/5 px-2.5 py-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-jarvis-warning" />
                  <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-jarvis-warning/90">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={dismissError}
                    className="shrink-0 text-jarvis-text-disabled transition-colors hover:text-jarvis-text"
                    aria-label="Dismiss error"
                  >
                    <IconClose size={11} />
                  </button>
                </div>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(input);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex min-w-0 flex-1 items-center">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={
                      listening
                        ? "Listening…"
                        : isStreaming
                          ? "JARVIS is responding…"
                          : "Issue a command or ask anything…"
                    }
                    aria-label="Message JARVIS"
                    disabled={listening}
                    className="h-10 w-full rounded-xl border border-jarvis-red/15 bg-jarvis-surface/60 pl-3 pr-3 text-[12.5px] text-white placeholder:text-jarvis-text-disabled focus:border-jarvis-red/40 focus:outline-none focus:ring-1 focus:ring-jarvis-red/25 disabled:opacity-60"
                  />
                </div>

                <button
                  type="button"
                  onClick={startListening}
                  disabled={!recognitionSupported}
                  title={
                    !recognitionSupported
                      ? "Speech recognition requires Chrome or Edge"
                      : listening
                        ? "Stop listening"
                        : "Speak to JARVIS"
                  }
                  aria-pressed={listening}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                    listening
                      ? "border-jarvis-success/50 bg-jarvis-success/15 text-jarvis-success jarvis-glow-sm"
                      : "border-jarvis-red/15 bg-jarvis-surface/60 text-jarvis-text-muted hover:border-jarvis-red/35 hover:text-jarvis-red disabled:cursor-not-allowed disabled:opacity-40"
                  }`}
                >
                  {listening ? <IconStop /> : <IconMic />}
                </button>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stopAll}
                    title="Stop generating"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-jarvis-red/40 bg-jarvis-red/15 text-jarvis-red transition-colors hover:bg-jarvis-red/25"
                  >
                    <IconStop />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    title="Send (Enter)"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-jarvis-red/30 bg-jarvis-red/15 text-jarvis-red transition-all hover:bg-jarvis-red/25 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <IconSend />
                  </button>
                )}
              </form>

              <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
                <div className="flex min-w-0 items-center gap-2 text-[8px] tracking-[0.12em] text-jarvis-text-disabled uppercase">
                  <span className="truncate">MEM · {memoryCount}</span>
                  {settings.wakeWordEnabled && recognitionSupported && (
                    <>
                      <span className="h-2 w-px bg-jarvis-red/15" />
                      <span className="flex items-center gap-1 truncate text-jarvis-red/70">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-jarvis-red" />
                        WAKE “{settings.wakePhrase || "jarvis"}”
                      </span>
                    </>
                  )}
                </div>
                <div className="shrink-0 font-mono text-[8px] tracking-wider text-jarvis-text-disabled/60">
                  ⌘⇧J
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
