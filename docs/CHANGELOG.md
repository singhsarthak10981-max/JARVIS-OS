# Changelog

All notable changes to JARVIS OS are documented here.

---

# v1.2.0 — Rekordbox Launchpad
Date: 19 October 2026

## Added
- **Rekordbox XML collection import** — reads the `DJ_PLAYLISTS` attribute
  format (`Name`, `Artist`, `AverageBpm`, `Tonality`, `TotalTime`, `Rating`,
  `Location`), decodes `file://localhost/...` paths and maps keys to Camelot.
  Traktor NML and CSV remain supported through the same entry point.
- **DJ launchpad** — Rekordbox is the primary target: launch/focus controls,
  signal-chain explanation (Spotify → Rekordbox → audio device), bridge status
  and a capability strip that separates what is ready from what is not.
- **Local bridge contract** (`features/dj/bridge.ts` + `useDjBridge`) — probes
  `127.0.0.1:7420`, with explicit `offline` / `unauthorized` / `blocked`
  states. No bridge is bundled; the proposal is in `docs/BRIDGE.md` and awaits
  approval.
- 13 new tests for the Rekordbox parser and format detection — 93 total

## Fixed
- **Desktop was rendering empty.** `DesktopGrid` participated in normal flow at
  `h-full`, pushing every window one viewport below the fold. It is now an
  absolutely positioned, pointer-transparent desktop layer.
- **Sidebar was permanently invisible.** Its Framer Motion `initial` set
  `x: -280, opacity: 0` but `animate` only listed `width`, so neither was ever
  animated. Both are now animated.
- **Windows overflowed small viewports.** Stored geometry is clamped to the
  workspace at render time, and a dock safe area stops windows rendering under
  the floating dock.
- Maximized windows now animate to percentage geometry instead of numeric
  values, so the maximize transition actually fills the shell.

## Changed
- DJ window retitled "DJ Workspace"; the module header is hidden inside it so
  the window chrome and module header no longer duplicate the title.
- DJ copy no longer presents Traktor as the default platform.

## Notes
- Spotify in Rekordbox requires Premium and is an official Rekordbox feature.
  Playback via Brave is **not** that integration, and the UI says so.
- No bridge is installed; launch/focus are unavailable until it is approved and
  built. Nothing is faked.

---

# v1.1.0 — Set Builder
Date: 19 October 2026

## Added
- **DJ module is real**: import a Traktor collection export (.nml/.xml/.csv/.tsv)
- Local-first parsing — collection files are read in the browser and never uploaded
- IndexedDB repository with chunked writes and progress reporting for large libraries
- Library workspace: search, BPM range, Camelot key filter, six sort modes, pagination
- Harmonic set builder: automatic Camelot detection, key + tempo flow score,
  key-clash warnings and "next up" suggestions
- Setlists saved locally (localStorage) with reorder and delete
- JARVIS library intents: "library status", "how many tracks do I have?",
  "find tracks at 128 BPM in 8A", "what's in my setlist?"
- 46 new tests (parsers, Camelot scoring, intents, component rendering) — 80 total

## Fixed
- Unknown BPM no longer scores as a perfectly compatible transition
- Traktor numeric key ids now resolve to explicit major/minor key names

## Notes
- The DJ module reads metadata only. JARVIS OS cannot play audio or control
  Traktor decks — that would require a native bridge and is not implemented.

---

# v1.0.0 — Intelligence
Date: 19 October 2026

## Added
- Streaming JARVIS API (`/api/jarvis`) with NDJSON responses
- Provider adapters: OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, Ollama, custom OpenAI-compatible endpoints
- Zero-key local intelligence core with honest capability boundaries
- Intent router for desktop control: modules, windows, themes, wallpaper, HUD toggles, timers, memory, reboot, diagnostics export
- Voice input with Web Speech API
- Configurable wake word with continuous listening and auto-recovery
- Spoken replies with voice selection, rate and pitch
- Long-term memory and conversation persistence
- Timer manager with notifications and voice alerts
- Assistant panel with streaming text, voice visualiser, provider badge and suggestions
- Real Settings app: providers, connection test, voice, wake word, themes, wallpaper, memory management, data and power controls
- Three runtime themes and six wallpaper presets
- Live Command Center: session uptime, window count, AI state, memory count, activity log
- Activity log across the OS plus JSON diagnostics export
- Connection status endpoint (`GET /api/jarvis`)
- Vitest suite for intent routing and the arithmetic engine
- CI pipeline: lint, typecheck, tests, production build
- Offline-safe local Geist fonts (no Google Fonts at build time)

## Fixed
- Build no longer fails when `fonts.googleapis.com` is unreachable
- Session restore no longer opens a duplicate Command Center window
- Desktop shortcuts and dock share the canonical window-opening path
- Command palette keyboard scrolling now targets the correct row
- Theme selection now actually applies to the UI
- Command palette placeholder commands replaced with working actions

---

# v0.5.0 — Pulse
Date: 31 July 2026

## Added
- Complete AI Orb Engine v2
- Seven AI states
  - Idle
  - Listening
  - Thinking
  - Speaking
  - Executing
  - Offline
  - Error
- Orb state machine
- Orb particle system
- Orb glow engine
- Orb ring engine
- Debug Panel (Ctrl + Shift + O)
- Zustand integration
- Orb design tokens
- New orbital animations

## Improved
- Modular AI architecture
- Component separation
- Rendering performance
- Reusable particle system
- State-driven animations

## Refactored
- Old ai-orb.tsx removed
- New AI Orb architecture
- Centralized tokens
- Store integration

Build Status:
✅ Production Build Passing