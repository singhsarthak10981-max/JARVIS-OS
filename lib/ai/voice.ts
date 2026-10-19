"use client";

/**
 * Browser voice layer: speech synthesis for JARVIS's replies and Web Speech
 * recognition for voice commands. All local — no audio ever leaves the browser
 * unless the browser vendor's recognition service is used by Chrome.
 */

let speechToken = 0;
let activeRecognition: SpeechRecognition | null = null;

export function supportsSynthesis(): boolean {
  return (
    typeof window !== "undefined" && "speechSynthesis" in window
  );
}

export function supportsRecognition(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.SpeechRecognition ?? window.webkitSpeechRecognition
  );
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!supportsSynthesis()) return [];
  return window.speechSynthesis.getVoices();
}

/** Some browsers populate voices asynchronously. */
export function waitForVoices(timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
  if (!supportsSynthesis()) return Promise.resolve([]);
  const existing = getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(getVoices());
    };
    synth.addEventListener("voiceschanged", finish);
    setTimeout(finish, timeoutMs);
  });
}

/**
 * Picks a dry, British-sounding voice when the platform offers one. Score is
 * deterministic so the selected voice stays stable across sessions.
 */
export function pickJarvisVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI?: string
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;

  if (preferredURI) {
    const preferred = voices.find((v) => v.voiceURI === preferredURI);
    if (preferred) return preferred;
  }

  const preferredNames = [
    "Daniel",
    "George",
    "Arthur",
    "Oliver",
    "Ryan",
    "Google UK English Male",
    "Microsoft Ryan",
    "Microsoft George",
    "Microsoft Guy",
    "Alex",
  ];

  let best: { voice: SpeechSynthesisVoice; score: number } | null = null;

  for (const voice of voices) {
    let score = 0;
    const lang = voice.lang.toLowerCase().replace("_", "-");
    const name = voice.name.toLowerCase();

    if (lang === "en-gb") score += 60;
    else if (lang.startsWith("en")) score += 25;

    const nameIndex = preferredNames.findIndex((n) =>
      name.includes(n.toLowerCase())
    );
    if (nameIndex !== -1) score += 45 - nameIndex;

    if (voice.localService) score += 4;
    if (name.includes("male")) score += 6;
    if (name.includes("female")) score -= 8;

    if (!best || score > best.score) best = { voice, score };
  }

  return best?.voice;
}

function plainText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, maxLength = 220): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean) continue;
    if (clean.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      const words = clean.split(" ");
      let long = "";
      for (const word of words) {
        if ((long + " " + word).trim().length > maxLength) {
          if (long) chunks.push(long);
          long = word;
        } else {
          long = `${long} ${word}`.trim();
        }
      }
      if (long) chunks.push(long);
      continue;
    }
    if ((current + " " + clean).trim().length > maxLength) {
      if (current) chunks.push(current);
      current = clean;
    } else {
      current = `${current} ${clean}`.trim();
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Speaks text with JARVIS's voice. Resolves when playback finishes. */
export async function speak(
  text: string,
  options: SpeakOptions = {}
): Promise<void> {
  if (!supportsSynthesis()) {
    options.onEnd?.();
    return;
  }

  const clean = plainText(text).slice(0, 4000);
  if (!clean) {
    options.onEnd?.();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const token = ++speechToken;
  const rate = Math.min(2, Math.max(0.5, options.rate ?? 1));
  const pitch = Math.min(2, Math.max(0.5, options.pitch ?? 0.9));
  const volume = Math.min(1, Math.max(0, options.volume ?? 1));

  const voices = getVoices();
  const voice = pickJarvisVoice(voices, options.voiceURI);

  const chunks = chunkText(clean);
  let index = 0;
  let settled = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  return new Promise<void>((resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      options.onEnd?.();
      resolve();
    };

    const next = () => {
      if (token !== speechToken) {
        finish();
        return;
      }
      if (index >= chunks.length) {
        finish();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index++]);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      utterance.lang = voice?.lang ?? "en-GB";
      if (voice) utterance.voice = voice;
      utterance.onend = next;
      utterance.onerror = next;

      try {
        synth.speak(utterance);
      } catch {
        finish();
      }
    };

    options.onStart?.();
    next();

    // Safety net for engines that never fire `end` (e.g. no audio device).
    const estimatedMs = 4000 + (clean.length / 9) * 1000 * (1 / rate);
    watchdog = setTimeout(finish, Math.min(180000, estimatedMs));
  });
}

export function stopSpeaking(): void {
  speechToken++;
  if (supportsSynthesis()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

// ── Recognition ────────────────────────────────────────────

export interface RecognizerHandlers {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface RecognizerOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

export interface RecognizerHandle {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function isRecognitionBlocked(error: string): boolean {
  return error === "not-allowed" || error === "service-not-allowed";
}

function friendlyRecognitionError(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in your browser settings and try again.";
    case "no-speech":
      return "I didn't catch any speech. Try again.";
    case "audio-capture":
      return "No microphone detected.";
    case "network":
      return "The speech recognition service is unreachable.";
    default:
      return `Speech recognition error (${error}).`;
  }
}

export function createRecognizer(
  handlers: RecognizerHandlers,
  options: RecognizerOptions = {}
): RecognizerHandle | null {
  if (!supportsRecognition()) return null;

  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;

  try {
    activeRecognition?.abort();
  } catch {
    // ignore
  }

  const recognition = new Ctor();
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.lang = options.lang ?? "en-GB";
  recognition.maxAlternatives = 1;

  let stopped = false;

  recognition.onstart = () => {
    handlers.onStart?.();
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) finalText += transcript;
      else interimText += transcript;
    }

    if (finalText.trim()) {
      handlers.onTranscript(finalText.trim(), true);
    } else if (interimText.trim()) {
      handlers.onTranscript(interimText.trim(), false);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === "aborted" || event.error === "no-speech") {
      if (event.error === "no-speech") {
        handlers.onError?.(friendlyRecognitionError(event.error));
      }
      return;
    }
    handlers.onError?.(friendlyRecognitionError(event.error));
  };

  recognition.onend = () => {
    if (activeRecognition === recognition) activeRecognition = null;
    if (!stopped) handlers.onEnd?.();
  };

  activeRecognition = recognition;

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        // start() throws if called twice; surface as end so callers recover.
        handlers.onEnd?.();
      }
    },
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
    abort: () => {
      stopped = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      if (activeRecognition === recognition) activeRecognition = null;
    },
  };
}

export function abortActiveRecognition(): void {
  try {
    activeRecognition?.abort();
  } catch {
    // ignore
  }
  activeRecognition = null;
}
