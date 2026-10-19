"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppStore } from "@/lib/store";
import { getProviderMeta } from "@/lib/ai/providers";
import {
  WAKE_WORD,
  resolveIntent,
  type IntentContext,
} from "@/lib/ai/intents";
import { executeJarvisAction, providerDisplayName } from "@/lib/ai/actions";
import { buildLocalReply } from "@/lib/ai/local";
import { fetchServerStatus, streamJarvis } from "@/lib/ai/client";
import {
  loadConversation,
  loadMemories,
  saveConversation,
  clearConversation as wipeConversation,
} from "@/lib/ai/memory";
import {
  abortActiveRecognition,
  createRecognizer,
  speak,
  stopSpeaking,
  supportsRecognition,
  supportsSynthesis,
  type RecognizerHandle,
} from "@/lib/ai/voice";
import type {
  AssistantMeta,
  ChatMessage,
  ServerStatus,
} from "@/lib/ai/types";
import {
  JARVIS_CLEAR_CHAT_EVENT,
  JARVIS_LISTEN_EVENT,
} from "@/lib/assistant-events";

interface JarvisContextValue {
  messages: ChatMessage[];
  isStreaming: boolean;
  listening: boolean;
  speaking: boolean;
  transcript: string;
  error: string | null;
  serverStatus: ServerStatus | null;
  lastMeta: AssistantMeta | null;
  recognitionSupported: boolean;
  synthesisSupported: boolean;
  send: (text: string) => Promise<void>;
  startListening: () => void;
  stopListening: () => void;
  stopAll: () => void;
  clearChat: () => void;
  retryLast: () => void;
  dismissError: () => void;
}

const JarvisContext = createContext<JarvisContextValue | null>(null);

let messageCounter = 0;
function newId(): string {
  return `msg-${Date.now()}-${++messageCounter}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const booted = useAppStore((s) => s.booted);
  const assistantOpen = useAppStore((s) => s.assistantOpen);
  const aiState = useAppStore((s) => s.aiState);
  const wakeWordEnabled = useAppStore((s) => s.settings.wakeWordEnabled);
  const wakePhrase = useAppStore((s) => s.settings.wakePhrase);
  const voiceEnabled = useAppStore((s) => s.settings.voiceEnabled);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [lastMeta, setLastMeta] = useState<AssistantMeta | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const streamingRef = useRef(false);
  const listeningRef = useRef(false);
  const recognitionRef = useRef<RecognizerHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserRef = useRef("");
  const fallbackNotifiedRef = useRef(false);
  const initializedRef = useRef(false);
  const greetedRef = useRef(false);

  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);

  useEffect(() => {
    setRecognitionSupported(supportsRecognition());
    setSynthesisSupported(supportsSynthesis());
  }, []);

  const commitMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const pushMessage = useCallback(
    (message: ChatMessage) => {
      commitMessages([...messagesRef.current, message]);
    },
    [commitMessages]
  );

  const updateMessage = useCallback(
    (id: string, updater: (message: ChatMessage) => ChatMessage) => {
      commitMessages(
        messagesRef.current.map((message) =>
          message.id === id ? updater(message) : message
        )
      );
    },
    [commitMessages]
  );

  // ── Startup: restore conversation + seed greeting ────────
  useEffect(() => {
    const stored = loadConversation();
    commitMessages(stored);
    initializedRef.current = true;
  }, [commitMessages]);

  useEffect(() => {
    if (!booted || !initializedRef.current || greetedRef.current) return;
    if (messagesRef.current.length > 0) {
      greetedRef.current = true;
      return;
    }
    greetedRef.current = true;

    const settings = useAppStore.getState().settings;
    const owner = settings.ownerName || "sir";
    const hour = new Date().getHours();
    const greeting =
      hour < 5
        ? "Working late"
        : hour < 12
          ? "Good morning"
          : hour < 18
            ? "Good afternoon"
            : "Good evening";
    const mode =
      settings.aiProvider === "local"
        ? "Local core online"
        : `${getProviderMeta(settings.aiProvider).label} uplink ready`;

    const inputHint = supportsRecognition()
      ? "Press the microphone and speak, or type a command"
      : "Type a command";
    const text = `${greeting}, ${owner}. All systems are online. ${mode}. ${inputHint} — I can open modules, change the theme, set timers, and remember things for you.`;

    commitMessages([
      {
        id: newId(),
        role: "assistant",
        text,
        timestamp: Date.now(),
        provider:
          settings.aiProvider === "local" ? "local core" : undefined,
      },
    ]);

    useAppStore
      .getState()
      .logActivity(`AI core online · ${mode}`, "success");
  }, [booted, commitMessages]);

  useEffect(() => {
    const timeout = setTimeout(() => saveConversation(messages), 300);
    return () => clearTimeout(timeout);
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    fetchServerStatus().then((status) => {
      if (!cancelled) setServerStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!assistantOpen) return;
    fetchServerStatus().then(setServerStatus);
  }, [assistantOpen]);

  const speakNow = useCallback(async (text: string) => {
    const settings = useAppStore.getState().settings;
    if (!settings.voiceEnabled) return;
    const store = useAppStore.getState();
    store.setAiState("speaking");
    await speak(text, {
      rate: settings.voiceRate,
      pitch: settings.voicePitch,
      voiceURI: settings.voiceURI,
    });
    if (useAppStore.getState().aiState === "speaking") {
      useAppStore.getState().setAiState("idle");
    }
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streamingRef.current) return;

      setError(null);
      const store = useAppStore.getState();
      const settings = store.settings;
      const owner = settings.ownerName || "sir";
      lastUserRef.current = text;

      pushMessage({
        id: newId(),
        role: "user",
        text,
        timestamp: Date.now(),
      });
      store.logActivity(`Query: ${text.slice(0, 70)}`, "ai");

      const memories = loadMemories().map((entry) => entry.text);
      const providerLabel = providerDisplayName(
        settings.aiProvider,
        settings.aiModel
      );

      const intentCtx: IntentContext = {
        ownerName: owner,
        activeModule: store.activeModule,
        openWindows: store.windows.length,
        providerLabel,
        providerIsLocal: settings.aiProvider === "local",
        memoryCount: memories.length,
        memories,
        currentTheme: settings.theme,
        wakePhrase: settings.wakePhrase,
      };

      const intent = resolveIntent(text, intentCtx);

      // ── Desktop action ────────────────────────────────────
      if (intent.kind === "action" && intent.action) {
        store.setAiState("executing");
        if (intent.thought) store.logActivity(intent.thought, "info");
        await wait(220);
        const result = executeJarvisAction(intent.action, {
          ownerName: owner,
          speak: (reply) => {
            void speakNow(reply);
          },
        });
        const reply = result.message || intent.reply || "Done.";
        pushMessage({
          id: newId(),
          role: "assistant",
          text: reply,
          timestamp: Date.now(),
          provider: "local core",
        });
        store.logActivity(
          `Action: ${reply.slice(0, 70)}`,
          result.ok ? "success" : "warning"
        );
        if (settings.voiceEnabled) void speakNow(reply);
        else if (useAppStore.getState().aiState === "executing") {
          useAppStore.getState().setAiState("idle");
        }
        return;
      }

      // ── Deterministic answer ──────────────────────────────
      if (intent.kind === "answer" && intent.reply) {
        pushMessage({
          id: newId(),
          role: "assistant",
          text: intent.reply,
          timestamp: Date.now(),
          provider: "local core",
        });
        if (settings.voiceEnabled) void speakNow(intent.reply);
        return;
      }

      // ── Language model ────────────────────────────────────
      store.setAiState("thinking");
      streamingRef.current = true;
      setIsStreaming(true);

      const assistantId = newId();
      pushMessage({
        id: assistantId,
        role: "assistant",
        text: "",
        timestamp: Date.now(),
        provider: providerLabel,
        streaming: true,
      });

      const history = messagesRef.current
        .filter(
          (message) =>
            (message.role === "user" || message.role === "assistant") &&
            !message.action &&
            !message.error &&
            message.text.trim().length > 0
        )
        .slice(-14)
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.text,
        }));

      const controller = new AbortController();
      abortRef.current = controller;
      let streamError: string | null = null;
      let received = "";
      let meta: AssistantMeta | null = null;

      try {
        meta = await streamJarvis(
          {
            messages: history,
            memories,
            ownerName: owner,
            provider: settings.aiProvider,
            model: settings.aiModel,
            baseUrl: settings.aiBaseUrl,
            context: {
              activeModule: store.activeModule,
              openWindows: store.windows.length,
            },
          },
          {
            signal: controller.signal,
            onMeta: (nextMeta) => {
              meta = nextMeta;
              setLastMeta(nextMeta);
              if (nextMeta.fallback && !fallbackNotifiedRef.current) {
                fallbackNotifiedRef.current = true;
                useAppStore.getState().addNotification({
                  title: "Local core active",
                  message:
                    nextMeta.reason ??
                    "No language model credentials found. JARVIS is running on the built-in local core.",
                  type: "info",
                });
              }
            },
            onDelta: (chunk) => {
              received += chunk;
              updateMessage(assistantId, (message) => ({
                ...message,
                text: message.text + chunk,
              }));
            },
            onError: (message) => {
              streamError = message;
            },
          }
        );
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          updateMessage(assistantId, (message) => ({
            ...message,
            streaming: false,
          }));
          streamingRef.current = false;
          setIsStreaming(false);
          abortRef.current = null;
          useAppStore.getState().setAiState("idle");
          return;
        }
        streamError =
          err instanceof Error ? err.message : "The uplink failed.";
      }

      streamingRef.current = false;
      setIsStreaming(false);
      abortRef.current = null;

      if (streamError) {
        setError(streamError);
        if (!received.trim()) {
          const fallback = buildLocalReply(text, owner, memories.length);
          received = fallback;
          meta = {
            provider: "local",
            model: "jarvis-local",
            source: "none",
            fallback: true,
            reason: streamError,
          };
          useAppStore.getState().addNotification({
            title: "Uplink interrupted",
            message: `${streamError} Falling back to the local core.`,
            type: "warning",
          });
        }
      }

      const finalText = received.trim() || "I didn't get a response. Try again.";
      updateMessage(assistantId, (message) => ({
        ...message,
        text: finalText,
        streaming: false,
        provider:
          meta && meta.provider !== "local"
            ? providerDisplayName(meta.provider, meta.model)
            : "local core",
        error: Boolean(streamError),
      }));

      useAppStore
        .getState()
        .logActivity(
          `JARVIS replied (${meta?.provider ?? "local"})`,
          streamError ? "warning" : "success"
        );

      if (useAppStore.getState().settings.voiceEnabled) {
        void speakNow(finalText);
      } else {
        useAppStore.getState().setAiState("idle");
      }
    },
    [pushMessage, speakNow, updateMessage]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
    setTranscript("");
    if (useAppStore.getState().aiState === "listening") {
      useAppStore.getState().setAiState("idle");
    }
  }, []);

  const startListening = useCallback(() => {
    if (!supportsRecognition()) {
      setError(
        "This browser doesn't support speech recognition. Try Chrome or Edge."
      );
      return;
    }

    if (listeningRef.current) {
      stopListening();
      return;
    }

    stopSpeaking();
    const store = useAppStore.getState();
    store.openAssistant();
    store.setAiState("listening");
    setError(null);
    setTranscript("");
    listeningRef.current = true;
    setListening(true);

    // Cancel any wake-word recognizer before opening the mic.
    abortActiveRecognition();

    const handle = createRecognizer(
      {
        onTranscript: (text, isFinal) => {
          setTranscript(text);
          if (!isFinal) return;

          setTranscript("");
          listeningRef.current = false;
          setListening(false);
          recognitionRef.current = null;
          if (useAppStore.getState().aiState === "listening") {
            useAppStore.getState().setAiState("idle");
          }
          if (text.trim()) void send(text);
        },
        onError: (message) => {
          setError(message);
        },
        onEnd: () => {
          if (!listeningRef.current) return;
          listeningRef.current = false;
          setListening(false);
          recognitionRef.current = null;
          if (useAppStore.getState().aiState === "listening") {
            useAppStore.getState().setAiState("idle");
          }
        },
      },
      { continuous: false, interimResults: true }
    );

    if (!handle) {
      listeningRef.current = false;
      setListening(false);
      useAppStore.getState().setAiState("idle");
      return;
    }

    recognitionRef.current = handle;
    handle.start();
  }, [send, stopListening]);

  const stopAll = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    streamingRef.current = false;
    setIsStreaming(false);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
    setTranscript("");
    stopSpeaking();
    const store = useAppStore.getState();
    if (
      store.aiState !== "idle" &&
      store.aiState !== "offline" &&
      store.aiState !== "error"
    ) {
      store.setAiState("idle");
    }
  }, []);

  const clearChat = useCallback(() => {
    wipeConversation();
    greetedRef.current = true;
    const settings = useAppStore.getState().settings;
    const owner = settings.ownerName || "sir";
    commitMessages([
      {
        id: newId(),
        role: "assistant",
        text: `Conversation cleared, ${owner}. I'm still here. What do you need?`,
        timestamp: Date.now(),
        provider: "local core",
      },
    ]);
    useAppStore.getState().logActivity("Conversation cleared", "info");
  }, [commitMessages]);

  const retryLast = useCallback(() => {
    if (lastUserRef.current) void send(lastUserRef.current);
  }, [send]);

  const dismissError = useCallback(() => setError(null), []);

  // ── Wake word ─────────────────────────────────────────────
  useEffect(() => {
    if (
      !wakeWordEnabled ||
      !recognitionSupported ||
      !booted ||
      listening ||
      aiState === "speaking" ||
      aiState === "listening" ||
      aiState === "thinking"
    ) {
      return;
    }

    let cancelled = false;
    let failed = false;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let handle: RecognizerHandle | null = null;
    const phrase = (wakePhrase || WAKE_WORD).toLowerCase().trim();

    const start = () => {
      if (cancelled || failed) return;
      handle = createRecognizer(
        {
          onTranscript: (text, isFinal) => {
            if (!isFinal || cancelled) return;
            const lower = text.toLowerCase();
            const index = lower.indexOf(phrase);
            if (index === -1) return;

            const command = text
              .slice(index + phrase.length)
              .replace(/^[\s,.:;!?-]+/, "")
              .trim();

            useAppStore.getState().openAssistant();
            useAppStore
              .getState()
              .logActivity("Wake word detected", "success");
            if (command) {
              void send(command);
            } else {
              startListening();
            }
          },
          onError: (message) => {
            if (message.includes("Microphone") || message.includes("blocked")) {
              failed = true;
              const store = useAppStore.getState();
              store.updateSettings({ wakeWordEnabled: false });
              store.addNotification({
                title: "Wake word disabled",
                message,
                type: "warning",
              });
            }
          },
          onEnd: () => {
            if (cancelled || failed || listeningRef.current) return;
            restartTimer = setTimeout(start, 800);
          },
        },
        { continuous: true, interimResults: true }
      );
      handle?.start();
    };

    restartTimer = setTimeout(start, 250);

    return () => {
      cancelled = true;
      if (restartTimer) clearTimeout(restartTimer);
      handle?.abort();
    };
  }, [
    wakeWordEnabled,
    wakePhrase,
    recognitionSupported,
    booted,
    listening,
    aiState,
    send,
    startListening,
  ]);

  // Command palette bridge.
  useEffect(() => {
    const listen = () => startListening();
    const clear = () => clearChat();
    window.addEventListener(JARVIS_LISTEN_EVENT, listen);
    window.addEventListener(JARVIS_CLEAR_CHAT_EVENT, clear);
    return () => {
      window.removeEventListener(JARVIS_LISTEN_EVENT, listen);
      window.removeEventListener(JARVIS_CLEAR_CHAT_EVENT, clear);
    };
  }, [startListening, clearChat]);

  // Stop the mic when the panel closes.
  useEffect(() => {
    if (!assistantOpen && listeningRef.current) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
      setTranscript("");
      if (useAppStore.getState().aiState === "listening") {
        useAppStore.getState().setAiState("idle");
      }
    }
  }, [assistantOpen]);

  // Keep the orb state honest if voice is disabled mid-reply.
  useEffect(() => {
    if (!voiceEnabled && useAppStore.getState().aiState === "speaking") {
      stopSpeaking();
      useAppStore.getState().setAiState("idle");
    }
  }, [voiceEnabled]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  const value = useMemo<JarvisContextValue>(
    () => ({
      messages,
      isStreaming,
      listening,
      speaking: aiState === "speaking",
      transcript,
      error,
      serverStatus,
      lastMeta,
      recognitionSupported,
      synthesisSupported,
      send,
      startListening,
      stopListening,
      stopAll,
      clearChat,
      retryLast,
      dismissError,
    }),
    [
      messages,
      isStreaming,
      listening,
      aiState,
      transcript,
      error,
      serverStatus,
      lastMeta,
      recognitionSupported,
      synthesisSupported,
      send,
      startListening,
      stopListening,
      stopAll,
      clearChat,
      retryLast,
      dismissError,
    ]
  );

  return (
    <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>
  );
}

export function useJarvis(): JarvisContextValue {
  const context = useContext(JarvisContext);
  if (!context) {
    throw new Error("useJarvis must be used inside a JarvisProvider");
  }
  return context;
}
