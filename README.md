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

API keys are **server-side only**. They are read inside `/api/jarvis`, never
sent to the browser, and never stored in `localStorage` or desktop snapshots.

Copy `.env.example` to `.env.local` and fill in the provider you want:

```bash
cp .env.example .env.local
# then set ONE of:
# GEMINI_API_KEY=...
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
```

Then **restart** the dev server (`npm run dev`) — Next.js does not hot-reload
`.env.local` — and press **Test connection** in **Settings → Intelligence**.

| Provider | Env variable | Default model |
| --- | --- | --- |
| Google Gemini | `GEMINI_API_KEY` (alias `GOOGLE_GENERATIVE_AI_API_KEY`) | `gemini-3.8-flash` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| OpenRouter | `OPENROUTER_API_KEY` | `openai/gpt-4o-mini` |
| Ollama | `OLLAMA_BASE_URL` | `llama3.2` |
| Custom OpenAI-compatible | `CUSTOM_AI_BASE_URL` | any |

Every model name is editable.

#### Web search (optional)

Add `TAVILY_API_KEY` to `.env.local` and the connected model can answer with
current information and clickable source links. JARVIS searches only when you
ask it to or when a question is clearly about something that changes — news,
releases, prices, versions, specs. At most five results per query; retrieved
pages are passed to the model as **untrusted data**, never as instructions.
Without a key, JARVIS says live search is unavailable instead of guessing.
Queries go to Tavily; the key never leaves the server.

Ask for **official sources** ("find the official Gemini API pricing") and the
first search is restricted to that vendor's first-party domains
(`ai.google.dev`, `platform.openai.com`, `docs.github.com`, …). If fewer than
two validated official documents or pricing pages come back, one broader
fallback runs and its results are clearly marked as secondary. Unknown vendors
get a normal search plus a "no official domain identified" notice — never a
made-up domain.

**If the selected provider has no server-side key, JARVIS says so.** It does not
silently answer with the local core and present it as a model response — a
connection test for Google fails, with the specific variable to set. Local Core
remains a deliberate, explicit offline choice.

See [`docs/AI_SETUP.md`](docs/AI_SETUP.md) for the full setup and
troubleshooting guide.

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

- Provider API keys are read from server-side environment variables only (`GEMINI_API_KEY`, `OPENAI_API_KEY`, …). They are never sent to the browser, stored in `localStorage`, included in desktop snapshots, or returned by the API. Older builds persisted a key in browser settings; it is deleted from storage on first load after upgrading.
- The browser cannot supply a key to `/api/jarvis` — a key in the request body is ignored.
- Provider status is exposed as booleans only ("configured / not configured"), never as key material.
- Gemini credentials travel in the `x-goog-api-key` header, so they cannot leak into proxy logs or URLs.
- Tavily search runs server-side only: the endpoint is a code constant (never a request field), and `TAVILY_API_KEY` is never sent to the browser or returned by the API. Only the query and up to five results leave the machine.
- The custom / Ollama base URL is user-controlled. **Do not expose this app publicly without adding authentication** — the route is an open proxy to whatever URL the client supplies.
- Voice recognition is provided by the browser; Chrome may send audio to its own speech service. Speech synthesis is local.

---

## Status

| Area | State |
| --- | --- |
| OS shell (boot, HUD, windows, dock, palette) | ✅ Complete |
| AI core, streaming, providers, local mode | ✅ Complete |
| Web search with cited sources (Tavily) | ✅ Complete — needs `TAVILY_API_KEY` |
| Voice input, wake word, spoken replies | ✅ Complete |
| Memory, timers, activity log | ✅ Complete |
| Settings + live Command Center | ✅ Complete |
| DJ / Producer / Bar / Business modules | 🚧 Scaffolded — next milestones |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full plan.

---

## Built by

Sarthak Singh — [github.com/singhsarthak10981-max](https://github.com/singhsarthak10981-max)

If you build on this, keep the name. JARVIS has standards.
