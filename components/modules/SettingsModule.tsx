"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import ModuleShell from "./ModuleShell";
import { cn } from "@/lib/utils";
import { tokens } from "@/lib/tokens";
import { useAppStore } from "@/lib/store";
import {
  PROVIDERS,
  THEMES,
  WALLPAPER_PRESETS,
  defaultModelFor,
  getProviderMeta,
  type ThemeId,
} from "@/lib/ai/providers";
import { fetchServerStatus, testConnection } from "@/lib/ai/client";
import {
  getVoices,
  pickJarvisVoice,
  speak,
  stopSpeaking,
  supportsRecognition,
  supportsSynthesis,
  waitForVoices,
} from "@/lib/ai/voice";
import {
  clearConversation,
  clearMemories,
  loadMemories,
  removeMemory,
  type MemoryEntry,
} from "@/lib/ai/memory";
import { executeJarvisAction } from "@/lib/ai/actions";

type TabId = "intelligence" | "voice" | "interface" | "system" | "about";

const TABS: { id: TabId; label: string; glyph: string }[] = [
  { id: "intelligence", label: "Intelligence", glyph: "◈" },
  { id: "voice", label: "Voice", glyph: "◉" },
  { id: "interface", label: "Interface", glyph: "▧" },
  { id: "system", label: "System", glyph: "⌗" },
  { id: "about", label: "About", glyph: "◇" },
];

const WALLPAPER_GRADIENTS: Record<string, string> = {
  "tactical-red":
    "linear-gradient(135deg, #050505 0%, #1a0008 55%, #ff0033 160%)",
  "midnight-blue":
    "linear-gradient(135deg, #050510 0%, #000a1a 55%, #0066ff 160%)",
  emerald: "linear-gradient(135deg, #050a05 0%, #001a0d 55%, #00ff88 160%)",
  "royal-purple":
    "linear-gradient(135deg, #08050a 0%, #0d001a 55%, #9933ff 160%)",
  carbon: "linear-gradient(135deg, #0a0a0a 0%, #171717 55%, #333333 160%)",
  "animated-gradient":
    "linear-gradient(135deg, #ff0033, #0066ff, #00ff88, #ff0033)",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[10px] font-semibold tracking-[0.2em] text-jarvis-red uppercase">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-[10.5px] leading-relaxed text-jarvis-text-muted">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[11px] text-jarvis-text">{title}</div>
        {description && (
          <div className="mt-0.5 text-[9.5px] leading-relaxed text-jarvis-text-disabled">
            {description}
          </div>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/50",
        checked
          ? "border-jarvis-red/40 bg-jarvis-red/25"
          : "border-jarvis-text-disabled/30 bg-jarvis-panel",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all",
          checked
            ? "left-[19px] bg-jarvis-red shadow-[0_0_8px_rgba(229,0,0,0.6)]"
            : "left-[2px] bg-jarvis-text-disabled"
        )}
      />
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] tracking-[0.16em] text-jarvis-text-muted uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={cn(
          "h-8 w-full rounded-md border border-jarvis-red/12 bg-jarvis-bg-primary/60 px-2.5 text-[11px] text-white placeholder:text-jarvis-text-disabled/70 focus:border-jarvis-red/40 focus:outline-none focus:ring-1 focus:ring-jarvis-red/20",
          mono && "font-mono text-[10.5px]"
        )}
      />
      {hint && (
        <span className="mt-1 block text-[9px] leading-relaxed text-jarvis-text-disabled">
          {hint}
        </span>
      )}
    </label>
  );
}

export default function SettingsModule() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSettings = useAppStore((s) => s.resetSettings);
  const setPersistenceEnabled = useAppStore((s) => s.setPersistenceEnabled);
  const setRestoreSession = useAppStore((s) => s.setRestoreSession);
  const logActivity = useAppStore((s) => s.logActivity);
  const clearActivity = useAppStore((s) => s.clearActivity);
  const reboot = useAppStore((s) => s.reboot);
  const persistenceEnabled = useAppStore((s) => s.persistenceEnabled);
  const restoreSession = useAppStore((s) => s.restoreSession);
  const wallpaper = useAppStore((s) => s.wallpaper);

  const [tab, setTab] = useState<TabId>("intelligence");
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<{
    status: "idle" | "testing" | "ok" | "error";
    message?: string;
  }>({ status: "idle" });
  const [serverKeys, setServerKeys] = useState<string[]>([]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [recognitionSupported, setRecognitionSupported] = useState(false);

  const providerMeta = getProviderMeta(settings.aiProvider);

  useEffect(() => {
    fetchServerStatus().then((status) => {
      if (!status) return;
      setServerKeys(
        Object.entries(status.providers)
          .filter(([, configured]) => configured)
          .map(([id]) => getProviderMeta(id).label)
      );
    });
  }, []);

  useEffect(() => {
    const stored = loadMemories();
    setMemories(stored);
    setMemoryCount(stored.length);
    setRecognitionSupported(supportsRecognition());
  }, [tab]);

  useEffect(() => {
    if (!supportsSynthesis()) return;
    const load = () => setVoices(getVoices());
    load();
    waitForVoices().then(setVoices);
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const modelPlaceholder = useMemo(() => {
    const fallback = defaultModelFor(settings.aiProvider);
    return fallback || "model-name";
  }, [settings.aiProvider]);

  const runTest = async () => {
    const current = useAppStore.getState().settings;
    const meta = getProviderMeta(current.aiProvider);

    if (current.aiProvider === "custom" && !current.aiBaseUrl.trim()) {
      setTestState({
        status: "error",
        message:
          "Enter the base URL of your OpenAI-compatible endpoint first.",
      });
      return;
    }

    if (meta.requiresKey && !current.aiApiKey.trim() && serverKeys.length === 0) {
      setTestState({
        status: "error",
        message: `Add an API key for ${meta.label}, or set it in .env.local on the server.`,
      });
      return;
    }

    setTestState({ status: "testing" });
    const result = await testConnection({
      provider: current.aiProvider,
      model: current.aiModel || defaultModelFor(current.aiProvider),
      apiKey: current.aiApiKey,
      baseUrl: current.aiBaseUrl,
    });
    setTestState({
      status: result.ok ? "ok" : "error",
      message: result.message,
    });
    logActivity(
      result.ok ? "Provider connection verified" : "Provider connection failed",
      result.ok ? "success" : "error"
    );
  };

  const previewVoice = () => {
    void speak(
      `Good evening, ${settings.ownerName || "sir"}. All systems operational.`,
      {
        rate: settings.voiceRate,
        pitch: settings.voicePitch,
        voiceURI: settings.voiceURI,
      }
    );
  };

  const setTheme = (theme: ThemeId) => {
    updateSettings({ theme });
    logActivity(`Theme set to ${THEMES.find((t) => t.id === theme)?.label}`, "success");
  };

  const setWallpaperPreset = (preset: string) => {
    const presets = tokens.wallpaper.presets as Record<
      string,
      { primary: string; secondary: string; accent: string }
    >;
    const colors = presets[preset] ?? presets["tactical-red"];
    useAppStore.getState().setWallpaper({
      type: preset === "animated-gradient" ? "animated" : "gradient",
      preset,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
    });
    logActivity(`Wallpaper set to ${preset.replace(/-/g, " ")}`, "success");
  };

  return (
    <ModuleShell
      moduleId="settings"
      title="Settings"
      description="Intelligence uplink, voice, interface and system state."
    >
      <div className="flex h-full min-h-0 gap-4">
        {/* Rail */}
        <nav className="flex w-[150px] shrink-0 flex-col gap-1" aria-label="Settings sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[10.5px] tracking-wide transition-colors",
                tab === item.id
                  ? "border-jarvis-red/30 bg-jarvis-red/10 text-jarvis-red"
                  : "border-transparent text-jarvis-text-muted hover:border-jarvis-red/10 hover:bg-jarvis-surface/40 hover:text-jarvis-text"
              )}
            >
              <span className="w-3 text-center text-[10px] opacity-70">{item.glyph}</span>
              {item.label}
            </button>
          ))}

          <div className="mt-auto space-y-2 pt-3">
            <button
              type="button"
              onClick={() => useAppStore.getState().openAssistant()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-jarvis-red/30 bg-jarvis-red/10 px-2 py-2 text-[9.5px] tracking-[0.14em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jarvis-red" />
              Summon JARVIS
            </button>
            <div className="text-center font-mono text-[8px] tracking-wider text-jarvis-text-disabled">
              v1.0.0 · BUILD STABLE
            </div>
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {tab === "intelligence" && (
            <motion.div
              key="intelligence"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <Section
                title="Language core"
                description="JARVIS works without any key using the built-in local core. Connect a model to unlock open-ended reasoning and conversation."
              >
                <div className="grid grid-cols-2 gap-1.5">
                  {PROVIDERS.map((provider) => {
                    const active = settings.aiProvider === provider.id;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => {
                          updateSettings({
                            aiProvider: provider.id,
                            aiModel: "",
                          });
                          setTestState({ status: "idle" });
                        }}
                        aria-pressed={active}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-left transition-colors",
                          active
                            ? "border-jarvis-red/40 bg-jarvis-red/10"
                            : "border-jarvis-red/10 bg-jarvis-surface/30 hover:border-jarvis-red/25 hover:bg-jarvis-surface/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-[10.5px] font-medium tracking-wide",
                              active ? "text-jarvis-red" : "text-jarvis-text"
                            )}
                          >
                            {provider.label}
                          </span>
                          {provider.local && (
                            <span className="rounded bg-jarvis-red/10 px-1 py-0.5 text-[7.5px] tracking-wider text-jarvis-red/80 uppercase">
                              built-in
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[8.5px] leading-snug text-jarvis-text-disabled">
                          {provider.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 p-3">
                  <p className="text-[10px] leading-relaxed text-jarvis-text-muted">
                    {providerMeta.description}
                  </p>

                  {!providerMeta.local && (
                    <div className="mt-3 space-y-2.5">
                      <TextField
                        label="Model"
                        value={settings.aiModel}
                        onChange={(value) => updateSettings({ aiModel: value })}
                        placeholder={modelPlaceholder}
                        hint={`Leave blank to use ${modelPlaceholder}.`}
                        mono
                      />

                      {providerMeta.requiresKey && (
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[9px] tracking-[0.16em] text-jarvis-text-muted uppercase">
                              API key
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowKey((value) => !value)}
                              className="text-[8.5px] tracking-wider text-jarvis-text-disabled uppercase hover:text-jarvis-red"
                            >
                              {showKey ? "hide" : "show"}
                            </button>
                          </div>
                          <input
                            type={showKey ? "text" : "password"}
                            value={settings.aiApiKey}
                            onChange={(event) =>
                              updateSettings({ aiApiKey: event.target.value })
                            }
                            placeholder={providerMeta.keyPlaceholder}
                            autoComplete="off"
                            spellCheck={false}
                            className="h-8 w-full rounded-md border border-jarvis-red/12 bg-jarvis-bg-primary/60 px-2.5 font-mono text-[10.5px] text-white placeholder:text-jarvis-text-disabled/70 focus:border-jarvis-red/40 focus:outline-none focus:ring-1 focus:ring-jarvis-red/20"
                          />
                          <p className="mt-1 text-[9px] leading-relaxed text-jarvis-text-disabled">
                            Stored only in this browser and sent only to the
                            JARVIS API route. Prefer{" "}
                            <code className="text-jarvis-text-muted">
                              .env.local
                            </code>{" "}
                            for permanent keys.
                          </p>
                        </div>
                      )}

                      {(
                        <TextField
                          label="Base URL"
                          value={settings.aiBaseUrl}
                          onChange={(value) =>
                            updateSettings({ aiBaseUrl: value })
                          }
                          placeholder={
                            providerMeta.defaultBaseUrl ??
                            "https://api.example.com/v1"
                          }
                          hint="OpenAI-compatible endpoint. Leave blank for the default."
                          mono
                        />
                      )}

                      <button
                        type="button"
                        onClick={runTest}
                        disabled={testState.status === "testing"}
                        className="w-full rounded-md border border-jarvis-red/25 bg-jarvis-red/10 py-1.5 text-[9.5px] tracking-[0.16em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20 disabled:opacity-50"
                      >
                        {testState.status === "testing"
                          ? "Testing uplink…"
                          : "Test connection"}
                      </button>

                      {testState.message && (
                        <p
                          className={cn(
                            "rounded-md border px-2.5 py-2 text-[9.5px] leading-relaxed",
                            testState.status === "ok"
                              ? "border-jarvis-success/25 bg-jarvis-success/5 text-jarvis-success"
                              : "border-jarvis-warning/25 bg-jarvis-warning/5 text-jarvis-warning"
                          )}
                        >
                          {testState.message}
                        </p>
                      )}

                      {serverKeys.length > 0 && (
                        <div className="text-[9px] leading-relaxed text-jarvis-text-disabled">
                          Server keys detected:{" "}
                          <span className="text-jarvis-text-muted">
                            {serverKeys.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {providerMeta.local && (
                    <div className="mt-2 rounded-md border border-jarvis-success/20 bg-jarvis-success/5 px-2.5 py-2 text-[9.5px] leading-relaxed text-jarvis-success/90">
                      Local core is always available. It controls the desktop,
                      answers system queries, sets timers and stores memories —
                      no key required.
                    </div>
                  )}
                </div>
              </Section>

              <Section
                title="Identity"
                description="How JARVIS addresses you across the OS."
              >
                <TextField
                  label="Owner name"
                  value={settings.ownerName}
                  onChange={(value) => updateSettings({ ownerName: value })}
                  placeholder="Sarthak"
                  hint="Used in the boot greeting, voice replies and system prompts."
                />
              </Section>
            </motion.div>
          )}

          {tab === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <Section
                title="Speech synthesis"
                description="JARVIS speaks replies through your browser's speech engine."
              >
                <Row
                  title="Spoken replies"
                  description="Read every response aloud with the selected voice."
                >
                  <Toggle
                    checked={settings.voiceEnabled}
                    onChange={(value) => {
                      updateSettings({ voiceEnabled: value });
                      if (!value) stopSpeaking();
                    }}
                    label="Spoken replies"
                    disabled={!supportsSynthesis()}
                  />
                </Row>

                <div className="space-y-2.5 rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 p-3">
                  <label className="block">
                    <span className="mb-1 block text-[9px] tracking-[0.16em] text-jarvis-text-muted uppercase">
                      Voice
                    </span>
                    <select
                      value={settings.voiceURI}
                      onChange={(event) =>
                        updateSettings({ voiceURI: event.target.value })
                      }
                      className="h-8 w-full rounded-md border border-jarvis-red/12 bg-jarvis-bg-primary/60 px-2 text-[10.5px] text-white focus:border-jarvis-red/40 focus:outline-none"
                    >
                      <option value="">
                        Auto —{" "}
                        {pickJarvisVoice(voices)?.name ?? "system default"}
                      </option>
                      {voices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 flex items-center justify-between text-[9px] tracking-[0.16em] text-jarvis-text-muted uppercase">
                        Rate <span className="font-mono">{settings.voiceRate.toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min="0.6"
                        max="1.4"
                        step="0.05"
                        value={settings.voiceRate}
                        onChange={(event) =>
                          updateSettings({
                            voiceRate: Number(event.target.value),
                          })
                        }
                        className="w-full accent-[#E50000]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex items-center justify-between text-[9px] tracking-[0.16em] text-jarvis-text-muted uppercase">
                        Pitch <span className="font-mono">{settings.voicePitch.toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min="0.6"
                        max="1.3"
                        step="0.05"
                        value={settings.voicePitch}
                        onChange={(event) =>
                          updateSettings({
                            voicePitch: Number(event.target.value),
                          })
                        }
                        className="w-full accent-[#E50000]"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={previewVoice}
                    disabled={!supportsSynthesis() || voices.length === 0}
                    className="w-full rounded-md border border-jarvis-red/25 bg-jarvis-red/10 py-1.5 text-[9.5px] tracking-[0.16em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20 disabled:opacity-40"
                  >
                    Preview voice
                  </button>

                  {voices.length === 0 && (
                    <p className="text-[9px] text-jarvis-text-disabled">
                      No voices found yet. Some browsers load them after the
                      first interaction.
                    </p>
                  )}
                </div>
              </Section>

              <Section
                title="Wake word"
                description="Listen continuously for the wake phrase, then take your command."
              >
                <Row
                  title="Wake word listening"
                  description={
                    recognitionSupported
                      ? "Chrome or Edge required. The microphone stays active while enabled."
                      : "Speech recognition is not available in this browser."
                  }
                >
                  <Toggle
                    checked={settings.wakeWordEnabled}
                    onChange={(value) =>
                      updateSettings({ wakeWordEnabled: value })
                    }
                    label="Wake word"
                    disabled={!recognitionSupported}
                  />
                </Row>

                <TextField
                  label="Wake phrase"
                  value={settings.wakePhrase}
                  onChange={(value) =>
                    updateSettings({ wakePhrase: value })
                  }
                  placeholder="jarvis"
                  hint="Say the phrase, then your command. Example: “Jarvis, open the DJ module”."
                />

                <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 px-3 py-2 text-[9px] leading-relaxed text-jarvis-text-disabled">
                  Browser support:{" "}
                  <span className={recognitionSupported ? "text-jarvis-success" : "text-jarvis-warning"}>
                    {recognitionSupported ? "speech recognition available" : "unavailable"}
                  </span>
                  {" · "}
                  speech synthesis{" "}
                  <span className={supportsSynthesis() ? "text-jarvis-success" : "text-jarvis-warning"}>
                    {supportsSynthesis() ? "available" : "unavailable"}
                  </span>
                </div>
              </Section>
            </motion.div>
          )}

          {tab === "interface" && (
            <motion.div
              key="interface"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <Section
                title="Theme"
                description="Accent palette for the entire operating environment."
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {THEMES.map((theme) => {
                    const active = settings.theme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setTheme(theme.id)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-lg border p-2.5 text-left transition-colors",
                          active
                            ? "border-jarvis-red/40 bg-jarvis-red/10"
                            : "border-jarvis-red/10 bg-jarvis-surface/30 hover:border-jarvis-red/25"
                        )}
                      >
                        <span
                          className="mb-2 block h-6 w-full rounded border border-white/10"
                          style={{
                            background: `radial-gradient(circle at 30% 30%, ${theme.swatch}, #080808 75%)`,
                          }}
                        />
                        <span className="block text-[10px] text-jarvis-text">
                          {theme.label}
                        </span>
                        <span className="mt-0.5 block text-[8px] leading-snug text-jarvis-text-disabled">
                          {theme.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="Wallpaper" description="Desktop background preset.">
                <div className="grid grid-cols-3 gap-1.5">
                  {WALLPAPER_PRESETS.map((preset) => {
                    const active = wallpaper.preset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWallpaperPreset(preset)}
                        aria-pressed={active}
                        className={cn(
                          "overflow-hidden rounded-lg border text-left transition-colors",
                          active
                            ? "border-jarvis-red/40"
                            : "border-jarvis-red/10 hover:border-jarvis-red/25"
                        )}
                      >
                        <span
                          className="block h-10 w-full"
                          style={{
                            background:
                              WALLPAPER_GRADIENTS[preset] ??
                              WALLPAPER_GRADIENTS["tactical-red"],
                          }}
                        />
                        <span className="block px-2 py-1.5 text-[8.5px] tracking-wide text-jarvis-text-muted capitalize">
                          {preset.replace(/-/g, " ")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="HUD overlays">
                <Row
                  title="Scan lines"
                  description="Subtle CRT overlay across the desktop."
                >
                  <Toggle
                    checked={settings.scanlines}
                    onChange={(value) => updateSettings({ scanlines: value })}
                    label="Scan lines"
                  />
                </Row>
                <Row
                  title="Ambient particles"
                  description="Drifting particles rendered on a canvas layer."
                >
                  <Toggle
                    checked={settings.particles}
                    onChange={(value) => updateSettings({ particles: value })}
                    label="Ambient particles"
                  />
                </Row>
              </Section>
            </motion.div>
          )}

          {tab === "system" && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <Section
                title="Session"
                description="JARVIS can restore your windows and workspaces between reloads."
              >
                <Row
                  title="Desktop persistence"
                  description="Save window layout, wallpaper and shortcuts."
                >
                  <Toggle
                    checked={persistenceEnabled}
                    onChange={setPersistenceEnabled}
                    label="Desktop persistence"
                  />
                </Row>
                <Row
                  title="Restore on launch"
                  description="Reload the previous desktop session at boot."
                >
                  <Toggle
                    checked={restoreSession}
                    onChange={setRestoreSession}
                    label="Restore session"
                  />
                </Row>
              </Section>

              <Section
                title="Memory bank"
                description="Facts JARVIS retains between sessions. Say “remember that…” or add one from the assistant."
              >
                {memories.length === 0 ? (
                  <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 px-3 py-2.5 text-[9.5px] text-jarvis-text-disabled">
                    No long-term memories stored yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {memories.slice(0, 8).map((memory) => (
                      <div
                        key={memory.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1 text-[10px] leading-relaxed text-jarvis-text-muted">
                          {memory.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = removeMemory(memory.id);
                            setMemories(next);
                            setMemoryCount(next.length);
                          }}
                          aria-label={`Forget: ${memory.text}`}
                          className="shrink-0 text-[10px] text-jarvis-text-disabled transition-colors hover:text-jarvis-red"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {memories.length > 8 && (
                      <div className="px-1 text-[8.5px] tracking-wider text-jarvis-text-disabled uppercase">
                        +{memories.length - 8} more
                      </div>
                    )}
                  </div>
                )}
              </Section>

              <Section title="Data" description="Local browser storage only.">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      clearConversation();
                      logActivity("Conversation cleared", "info");
                    }}
                    className="rounded-md border border-jarvis-red/15 bg-jarvis-surface/30 px-2 py-2 text-[9.5px] tracking-wide text-jarvis-text-muted transition-colors hover:border-jarvis-red/30 hover:text-jarvis-text"
                  >
                    Clear conversation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearMemories();
                      setMemories([]);
                      setMemoryCount(0);
                      logActivity("Memory bank cleared", "warning");
                    }}
                    className="rounded-md border border-jarvis-red/15 bg-jarvis-surface/30 px-2 py-2 text-[9.5px] tracking-wide text-jarvis-text-muted transition-colors hover:border-jarvis-red/30 hover:text-jarvis-text"
                  >
                    Clear memory ({memoryCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      executeJarvisAction(
                        { type: "export-logs" },
                        { ownerName: settings.ownerName, speak: () => {} }
                      );
                    }}
                    className="rounded-md border border-jarvis-red/15 bg-jarvis-surface/30 px-2 py-2 text-[9.5px] tracking-wide text-jarvis-text-muted transition-colors hover:border-jarvis-red/30 hover:text-jarvis-text"
                  >
                    Export diagnostics
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearActivity();
                      logActivity("Activity log cleared", "info");
                    }}
                    className="rounded-md border border-jarvis-red/15 bg-jarvis-surface/30 px-2 py-2 text-[9.5px] tracking-wide text-jarvis-text-muted transition-colors hover:border-jarvis-red/30 hover:text-jarvis-text"
                  >
                    Clear activity log
                  </button>
                </div>
              </Section>

              <Section title="Power" description="Restart the shell or return to defaults.">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => reboot()}
                    className="rounded-md border border-jarvis-warning/25 bg-jarvis-warning/5 px-2 py-2 text-[9.5px] tracking-wide text-jarvis-warning transition-colors hover:bg-jarvis-warning/10"
                  >
                    Reboot JARVIS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetSettings();
                      logActivity("Settings reset to defaults", "warning");
                    }}
                    className="rounded-md border border-jarvis-red/25 bg-jarvis-red/5 px-2 py-2 text-[9.5px] tracking-wide text-jarvis-red transition-colors hover:bg-jarvis-red/10"
                  >
                    Reset all settings
                  </button>
                </div>
                <p className="text-[9px] leading-relaxed text-jarvis-text-disabled">
                  Resetting restores the default theme, local core and voice
                  configuration. The saved API key is removed from this browser;
                  long-term memories are not affected.
                </p>
              </Section>
            </motion.div>
          )}

          {tab === "about" && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <Section title="JARVIS OS" description="Just A Rather Very Intelligent System.">
                <div className="rounded-lg border border-jarvis-red/15 bg-jarvis-surface/30 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-light tracking-[0.2em] text-jarvis-red uppercase text-glow-sm">
                      J.A.R.V.I.S.
                    </span>
                    <span className="font-mono text-[9px] text-jarvis-text-disabled">
                      v1.0.0
                    </span>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-jarvis-text-muted">
                    A voice-first AI operating environment: tactical desktop,
                    window manager, module system, local intelligence core and
                    optional uplink to any major language model.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-jarvis-text-disabled">
                    <div>
                      Runtime <span className="text-jarvis-text-muted">Next.js 16</span>
                    </div>
                    <div>
                      UI <span className="text-jarvis-text-muted">React 19 · Tailwind 4</span>
                    </div>
                    <div>
                      State <span className="text-jarvis-text-muted">Zustand</span>
                    </div>
                    <div>
                      Motion <span className="text-jarvis-text-muted">Framer Motion</span>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Shortcuts">
                <div className="space-y-1.5">
                  {[
                    ["Summon JARVIS", "⌘ / Ctrl + Shift + J"],
                    ["Voice input", "Microphone in assistant panel"],
                    ["Command palette", "⌘ / Ctrl + K"],
                    ["Toggle sidebar", "⌘ / Ctrl + B"],
                    ["Module 0–5", "⌘ / Ctrl + 0…5"],
                    ["Debug panel (dev)", "Ctrl + Shift + O"],
                  ].map(([action, shortcut]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between rounded border border-jarvis-red/10 bg-jarvis-surface/30 px-2.5 py-1.5"
                    >
                      <span className="text-[9.5px] text-jarvis-text-muted">{action}</span>
                      <kbd className="rounded border border-jarvis-red/15 bg-jarvis-bg-primary px-1.5 py-0.5 font-mono text-[8.5px] text-jarvis-red/70">
                        {shortcut}
                      </kbd>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Uplink providers">
                <p className="text-[9.5px] leading-relaxed text-jarvis-text-muted">
                  OpenAI · Anthropic · Google Gemini · Groq · OpenRouter ·
                  Ollama · any OpenAI-compatible endpoint.
                </p>
                <a
                  href="https://github.com/singhsarthak10981-max/JARVIS-OS"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[9.5px] tracking-wide text-jarvis-red/80 hover:text-jarvis-red"
                >
                  github.com/singhsarthak10981-max/JARVIS-OS ↗
                </a>
              </Section>
            </motion.div>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
