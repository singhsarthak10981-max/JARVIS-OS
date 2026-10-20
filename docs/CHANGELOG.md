# Changelog

All notable changes to JARVIS OS are documented here.

---

# v1.5.0 — Multimodal Foundation: Image Input
Date: 20 October 2026

## Added
- **Image input for vision-capable models.** Attach PNG, JPEG or WebP images
  (file picker, drag-and-drop onto the panel, or clipboard paste), preview and
  remove them, then send a normal prompt and get a streamed answer. Limits:
  3 images per message, 5 MiB each, 10 MiB total, enforced in the browser and
  again on the server (strict base64 plus magic-byte type verification —
  declared types are never trusted).
- **A typed model-capability registry** (`lib/ai/model-capabilities.ts`),
  separate from both availability and credentials. The initial catalog is
  verified against official provider documentation. Unknown models, Custom
  endpoints and Local Core are text-only; Local Core never pretends to have
  seen an image. The repository defaults for OpenAI, Anthropic, Google and
  OpenRouter are vision-capable; Groq and Ollama need a vision model selected
  (e.g. `qwen/qwen3.8-27b`, `ollama pull qwen3-vl:8b`).
- **Honest refusals.** A model that cannot view images blocks submission with
  the reason in the composer (`unsupported_modality` server-side) — the image
  is never silently dropped and JARVIS never switches provider or model on
  its own. The composer names the destination (cloud provider + model, or
  local Ollama) before anything is sent.
- Per-adapter serialization on the existing HTTP transports (no new SDK):
  OpenAI-compatible `image_url` parts (including Ollama's `/v1` endpoint),
  Anthropic base64 image blocks, Gemini `inline_data` parts. Text-only
  requests are byte-for-byte what they were before.
- `docs/MULTIMODAL.md` (architecture, verified catalog, privacy invariants,
  known limitations) and an "Image input (vision)" section in
  `docs/AI_SETUP.md`. Audio/video/image-generation capability fields exist in
  the registry, all off, so future work doesn't reshape it.

## Privacy
- Image bytes and data URLs never enter browser persistence, the saved-memory
  pinboard, SQLite (memory, conversation history, reflection learning),
  telemetry, logs, diagnostics, error messages or provider metadata. History
  stays text-only: follow-up turns can't see an earlier image — re-attach to
  ask more. No third-party file hosting; an image leaves the machine only on
  deliberate submission to the provider the user selected. Memory v2's
  boundaries are unchanged.

## Tests
- 79 new tests (capability lookup incl. unknown/Local Core defaults,
  attachment validation incl. spoofed types and size caps, per-adapter
  serialization, route gating with zero provider calls on refusal,
  persistence/reflection exclusion, composer UI) — 831 total across 59 files.
  `npm run verify` and `npm run build` pass. A manual smoke ran against a
  fake local Ollama endpoint (streamed vision reply, refusal for a text-only
  model, 400 for malformed payloads, empty-handed SQLite); no live cloud
  provider was called.

## Not implemented
- Audio transcription, real-time voice, video understanding and image
  generation. They are designed for in the capability registry and are not
  advertised anywhere as working.

---

# v1.4.0 — Persistent Decks & Bridge Design
Date: 19 October 2026

## Added
- **Persistent deck assignments.** Deck contents survive a reload. Only track
  ids are stored (`jarvis-dj-decks-v1`, versioned, 4 fixed slots, ids capped at
  128 chars), never audio. Decoded waveforms are not persistable and the UI says
  so via the "Assignments saved" indicator.
- A stored assignment whose track has left the library is shown as "Track no
  longer in library" rather than silently disappearing, and the id is not
  dropped until you unload it.
- `libraryLoaded` distinguishes "library still loading" from "track is gone", so
  a slow IndexedDB read never looks like four deleted tracks.
- **`docs/BRIDGE.md` rewritten as an approval artefact**: exact four-action
  allowlist, CSPRNG bearer token with constant-time comparison, loopback-only
  bind, origin allowlist, 8-step request validation that rejects unknown
  properties, 1 KB body cap, rate limiting, manual start/stop/revoke, and a
  24-case Windows test plan including autostart-absence checks.
- Rekordbox runtime state type (`unknown | running | stopped`) with
  `runtimeFromHealth` — absent report resolves to **unknown**, never running.

## Changed
- Status bar now reports `REKORDBOX: STATUS UNKNOWN` instead of conflating
  process state with bridge connectivity.
- A successful launch request reports "status unknown until the bridge reports
  it" — it never implies the application started.
- Spotify web player is now the single primary action (default), with the
  desktop app demoted to an optional "Try desktop app" link.
- Performance header states "Rekordbox status unknown".

## Tests
- 19 new tests (deck store: sanitisation, round-trip, corrupt JSON, version
  mismatch, missing-track resolution; runtime reporting: unknown-never-running,
  explicit-boolean-only, launch-request honesty) — 133 total.

## Not implemented
- `tools/bridge/` does not exist. Nothing is installed, running, or scheduled to
  autostart. Bridge creation and a first run both require explicit approval.

---

# v1.3.0 — DJ Performance Surface
Date: 19 October 2026

## Added
- **Performance view** in the DJ module, following the performance-module
  reference layout: four decks, collection strip, and a right rail for voice,
  Spotify and session state.
- **Real local waveform analysis** — pick a local audio file and the browser
  decodes it with the Web Audio API and draws the actual peak envelope. Nothing
  is uploaded and no stream is captured. No file, no waveform; never a
  generated pattern.
- **Deck assignment** from the imported collection, with per-deck harmonic
  suggestions scored by the existing Camelot engine.
- **Voice activation panel** wired to the real Web Speech recogniser, listing
  only commands that resolve today and marking bridge-dependent ones.
- **Spotify Free · Brave panel** — detects Brave via `navigator.brave` and
  offers web-player and `spotify:` hand-offs. Deliberately not an integration.
- **Status bar and session log** built from measured state, with unmeasurable
  fields marked `UNVERIFIED` / `—`.
- Voice intents: "open/exit performance view", "show the launchpad", and
  "recommend energy 126" (real BPM search over the imported library).
- 12 new tests (performance rendering, status-bar truthfulness, intent routing)
  — 114 total

## Changed
- `DjView` moved into the store so voice intents and UI share one source of
  truth for the active DJ surface.
- `ModuleShell` gained a `flush` mode for dense surfaces that own their layout.
- DJ module has three tabs: Launchpad, Performance, Library.

## Not implemented (by design)
- Deck transport, hot cues, loops and EQ are inert. They belong to Rekordbox;
  a browser cannot drive them.
- Audio interface, latency and controller state are not readable from a page
  and are reported as unverified. Controller support is a later phase.

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