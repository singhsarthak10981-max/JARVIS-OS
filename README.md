# JARVIS OS

> **Just A Rather Very Intelligent System** — a voice-first AI operating environment for your desktop.

JARVIS OS is a tactical, red-themed browser desktop with a real AI assistant underneath it: a window manager, module system, command palette, JARVIS-controlled themes, timers, long-term memory, speech recognition, spoken replies, and an optional uplink to any major language model.

The visual shell is complete. The assistant is no longer a mock-up — it streams real responses, executes desktop actions, and works **with zero API keys** through a built-in local core.

---

## What it can do

### Talk to it
- **Voice input** via the Web Speech API (Chrome / Edge).
- **Wake word** — say “Jarvis” (configurable) followed by a command.
- **Spoken replies** with a British-accented voice when available, adjustable rate and pitch.
- **Text chat** with streaming responses in a glass assistant panel.
- **Memory** — “remember that…” persists facts across sessions; memories are injected into every model prompt.
- **Timers** — “remind me in 20 minutes to check the mix”, with desktop notification and voice alert.

### Control the OS with your voice
| Say this | JARVIS does |
| --- | --- |
| “Open the DJ module” | Mounts / focuses the DJ window |
| “Close all windows” | Clears the desktop |
| “Switch to stealth theme” | Re-themes the whole OS instantly |
| “Set the wallpaper to emerald” | Changes the desktop background |
| “Enable scanlines” / “turn off particles” | Toggles HUD layers |
| “System status report” | Answers with live session state |
| “Export the logs” | Downloads a diagnostics JSON |
| “Reboot” | Replays the full boot sequence |

Anything that isn’t a desktop action goes to the language model (or the local core).

### Use the OS
- Boot sequence with personalised greeting
- Draggable, resizable, snapping window manager
- Dock with running/minimized state
- Command palette (`⌘K` / `Ctrl+K`) with “Ask JARVIS: …”
- Desktop shortcuts, workspaces, context menu
- Session persistence (windows, wallpaper, shortcuts)
- Three themes: Tactical Red · Arc Reactor · Stealth
- Six wallpaper presets including an animated canvas
- Live Command Center: uptime, windows, AI state, memory count, activity log
- **Settings** app: provider configuration, connection test, voice, wake word, themes, memory management, diagnostics

---

## Quick start

```bash
git clone https://github.com/singhsarthak10981-max/JARVIS-OS.git
cd JARVIS-OS
npm install
npm run dev
```

Open **http://localhost:3000**. JARVIS boots into the local core — no configuration required. Click the orb, the **Assistant** entry in the sidebar, or press `⌘⇧J` / `Ctrl+Shift+J`.

### Connect a language model (optional)

Two ways:

**1. Server-side keys (recommended)** — copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
# then set one of:
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
# GEMINI_API_KEY=...
```

**2. In-app** — open **Settings → Intelligence**, choose a provider, paste a key, press **Test connection**. The key is stored in this browser’s `localStorage` only and sent to your own `/api/jarvis` route.

| Provider | Env variable | Default model |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| Google Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| OpenRouter | `OPENROUTER_API_KEY` | `openai/gpt-4o-mini` |
| Ollama | `OLLAMA_BASE_URL` | `llama3.2` |
| Custom OpenAI-compatible | `CUSTOM_AI_BASE_URL` | any |

Every model name is editable. If a provider has no usable key, the API automatically falls back to the local core and tells the assistant panel why.

#### Run fully local with Ollama

```bash
ollama pull llama3.2
ollama serve
# Settings → Intelligence → Ollama, or OLLAMA_BASE_URL=http://127.0.0.1:11434
```

---

## Architecture

```
Browser
├── Desktop shell (windows, dock, sidebar, HUD, palette)
├── JARVIS provider ─────────────────────────────────────────┐
│   ├── intent router  (deterministic desktop actions)       │
│   ├── action executor (zustand store + timers + memory)    │
│   ├── voice layer (recognition + synthesis)                │
│   └── stream client ──► /api/jarvis ──► provider adapter   │
│                              ├── OpenAI-compatible (SSE)   │
│                              ├── Anthropic (SSE)           │
│                              ├── Google Gemini (SSE)       │
│                              └── local core (zero-key)     │
└────────────────────────────────────────────────────────────┘
```

**Intent-first design.** Every message hits `lib/ai/intents.ts` before any network call. If it maps to a desktop action, JARVIS executes it instantly and replies deterministically. Only genuinely conversational turns reach a model. That keeps latency low, makes offline mode useful, and avoids paying tokens for “open settings”.

Key files:

```
app/api/jarvis/route.ts      Streaming API route (NDJSON)
lib/ai/server.ts             Provider adapters, prompts, connection probe
lib/ai/intents.ts            Intent router + wake word handling helpers
lib/ai/actions.ts            Executes intents against the OS
lib/ai/voice.ts              Speech recognition + synthesis
lib/ai/memory.ts             Long-term memory + conversation persistence
lib/ai/timers.ts             Timer manager
lib/ai/local.ts              Zero-key language core
components/assistant/        Provider, panel, message UI, voice visualiser
components/modules/SettingsModule.tsx
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite (intent router + math engine) |
| `npm run verify` | Lint + typecheck + tests (the full pre-push gate) |

The bundled GitHub workflow builds the app on every push and pull request. Run `npm run verify` locally before pushing; see [`docs/TESTING.md`](docs/TESTING.md) for details.

---

## Design

- Tactical Red (`#E50000`) on near-black, glass surfaces, red reserved for state and hierarchy
- Geist Sans / Geist Mono bundled locally (no Google Fonts at build time)
- Framer Motion for the orb, boot sequence, panels and windows
- Tailwind CSS 4 tokens mapped to CSS variables, which is what makes runtime theming possible
- Zustand for navigation, windows, settings, activity, notifications and AI state

See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Security notes

- API keys in **Settings** live in this browser’s `localStorage` and are only sent to your own Next.js route. Prefer `.env.local` for permanent keys.
- Keys are never included in diagnostics exports and never returned by the API.
- The custom / Ollama base URL is user-controlled. **Do not expose this app publicly without adding authentication** — the route is an open proxy to whatever URL the client supplies.
- Voice recognition is provided by the browser; Chrome may send audio to its own speech service. Speech synthesis is local.

---

## Status

| Area | State |
| --- | --- |
| OS shell (boot, HUD, windows, dock, palette) | ✅ Complete |
| AI core, streaming, providers, local mode | ✅ Complete |
| Voice input, wake word, spoken replies | ✅ Complete |
| Memory, timers, activity log | ✅ Complete |
| Settings + live Command Center | ✅ Complete |
| DJ / Producer / Bar / Business modules | 🚧 Scaffolded — next milestones |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full plan.

---

## Built by

Sarthak Singh — [github.com/singhsarthak10981-max](https://github.com/singhsarthak10981-max)

If you build on this, keep the name. JARVIS has standards.
