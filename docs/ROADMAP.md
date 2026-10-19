# JARVIS OS Roadmap

## ✅ Phase 1
- Boot Sequence
- Sidebar
- HUD
- AI Orb
- Dashboard

Status: Complete

---

## ✅ Phase 2
- Command Palette
- Keyboard Navigation
- Search Commands

Status: Complete

---

## ✅ Phase 3
- Module Router

Status: Complete

---

## ✅ Phase 4
- Zustand Global Store

Status: Complete

---

## ✅ Phase 5
- Design System
- Tokens
- Theme Audit

Status: Complete

---

## ✅ Phase 6
- AI Orb Engine v2

Status: Complete

---

## ✅ Sprint 6
Voice Assistant Foundation

- Browser speech recognition (Web Speech API)
- Wake Word ("Jarvis")
- Conversation Manager
- Intent Router
- Spoken replies (speech synthesis)
- Multi-provider LLM uplink + zero-key local core

Status: Complete (v1.0.0)

---

## ✅ Sprint 7
Memory System

- Conversation history persistence
- Long-term memory (remember / recall / forget)
- Memory injection into model context
- User profile (owner name, voice, provider preferences)

Status: Complete (v1.0.0)

---

## Sprint 8
Desktop Integration

- System control (windows, modules, themes, timers) ✅
- App launcher ✅
- Notifications ✅
- Clipboard 🚧
- File search 🚧
- Calendar / weather / smart-home integrations 🚧

---

## 🚧 Sprint 9
DJ Workspace — **Rekordbox-first (v1.2.0)**

The DJ pillar targets **Rekordbox** as the deck software and **Spotify** as the
music source. JARVIS owns voice, launch, status and the DJ workspace UI;
Rekordbox owns decks, mixing, effects and waveforms.

Shipped:
- Rekordbox XML collection import (`DJ_PLAYLISTS` attribute format), alongside
  existing Traktor NML and CSV/TSV support — one shared parser layer
- IndexedDB persistence for large libraries (50k tracks, chunked writes)
- DJ launchpad: Rekordbox launch/focus controls, signal-chain explanation,
  bridge status, honest capability strip
- Library table: search, BPM range, Camelot key filter, sort, pagination
- Harmonic set builder: Camelot auto-detection, key/tempo flow scoring,
  clash warnings, "next up" suggestions
- Setlists persisted locally; JARVIS can query library status and search by
  BPM/key/artist

Sprint 9b — Performance surface (v1.3.0):
- Performance view: four decks, collection strip, voice/Spotify/session rail
- Real local waveform decode (Web Audio, no upload, no capture)
- Deck assignment + per-deck harmonic suggestions from the Camelot engine
- Voice intents for entering/exiting the view and BPM recommendations
- Honest status bar: unmeasurable fields are UNVERIFIED, never invented

Remaining:
- Local bridge for terminal launch/focus — proposed in `docs/BRIDGE.md`,
  **awaiting approval**; nothing runs on the PC yet
- Spotify Premium in Rekordbox — an official feature of Rekordbox, not something
  JARVIS can enable. Current playback is Spotify in Brave, which is not the same
  thing and is described as such in the UI
- DJ controller support — not claimed. Depends on Rekordbox, not on JARVIS
- Real-time deck/transport telemetry (would need Pro DJ Link or MIDI from the
  bridge; must not be faked)

---

## Sprint 10
Producer Workspace

- FL Studio integration
- AI composition
- Mixing assistant

---

## Sprint 11
Business Workspace

- Bar management
- Inventory
- Analytics
- Staff management

---

## Sprint 12
Personal ERP

- Calendar
- Tasks
- Finance
- Health
- Knowledge Base

---

## ✅ Sprint 13 — Capability Runtime + Local Performance Telemetry

- Typed capability registry, with `implemented`, `unavailable`, and `planned` states
- Standard action result contract
- Opt-in, local-only, metadata-only telemetry and aggregate diagnostics
- Strict event validation, bounded request bodies, bounded local rotation
- Cross-platform storage availability detection, including Windows path-layout cases

Status: Complete — PRs #8 and #9 merged; Windows verification passed.

---

## ✅ Sprint 14 — Truthful HUD Indicators

- Replace decorative always-green status lights with qualified network/API/voice states
- Accessible descriptions explain what a state does and does not prove
- Tests for unknown, ready, inactive and problem states

Status: Merged in PR #10; production build and local verification passed.

---

## 🚧 Sprint 15 — Stark Interface v1

- Add the graphite/cyan Stark Interface theme while preserving existing themes
- Make ambient arc, neural core and HUD state colors theme-aware
- Add a fine-pointer circular reticle cursor
- Replace the conventional collapsed sidebar with a 14px left-edge reveal tray, auto-hide and pin control
- Audit keyboard navigation, reduced motion and responsive layouts

Status: Core changes merged in PR #11; the smaller, latency-free reticle follow-up merged in PR #12 and was confirmed by the user. Visual sign-off across target resolutions is still pending. See [Stark Interface Sprint](./STARK_INTERFACE_SPRINT.md).

---

## 🔜 Sprint 16 — Local File Access

- Start with an explicit, user-selected file or directory and read-only access
- Bound file sizes and traversal depth; validate supported file formats
- No system-wide scanning, execution, or write/delete actions in the first release
- Maintain explicit permission, cancellation and revocation states

Status: First slice implemented on `feat/local-file-import-v1`: one explicitly selected text file, bounded preview, no persistent storage or automatic upload. Awaiting local Windows verification and merge; directory scanning and AI context attachment remain out of scope. See [Integrations Roadmap](./INTEGRATIONS_ROADMAP.md).

---

## 🔜 Sprint 17 — Read-Only External Integrations

- Weather: validated forecast results with timestamp/source and clear offline states
- Calendar: OAuth read-only access first
- Email: metadata/read-only first, after permissions and deployment model are defined
- Keep tokens and personal content out of localStorage, desktop snapshots and telemetry

Status: Planned. Each adapter requires its own real implementation, setup flow and tests before the registry can say implemented.

---

## 🔒 Sprint 18 — Optional Local Desktop Bridge

- Loopback-only, authenticated helper with a fixed allowlist
- First candidate actions: status and launch/focus an approved named application
- No shell-command endpoint, arbitrary paths or silent autostart
- Preserve the existing approval gates for creating and manually running the bridge

Status: Design-only; not implemented. See [Local Bridge](./BRIDGE.md).

---

**Roadmap note:** Sprint 15 core changes are merged but visual sign-off remains open; Sprint 16 has a first-slice implementation under review. Later phases remain planned. Check the capability registry for what the current build can actually do.
