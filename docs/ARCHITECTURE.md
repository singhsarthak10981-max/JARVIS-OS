# Architecture

JARVIS
├── UI
│   ├── Desktop shell (windows, dock, HUD, palette)
│   └── Assistant panel
├── Router (intent + command palette)
├── Global Store (zustand)
├── AI Core
│   ├── Local intent router
│   ├── Capability registry (describes what the router can invoke)
│   ├── Action executor
│   ├── Streaming API route
│   └── Provider adapters (OpenAI-compatible / Anthropic / Gemini)
├── Local telemetry (opt-in, metadata only)
│   ├── Turn/action/search measurement (browser)
│   ├── /api/jarvis/telemetry (validation + aggregates)
│   └── .jarvis-data/telemetry/*.jsonl (server filesystem)
├── Memory (localStorage facts + conversation)
├── Voice (Web Speech recognition + synthesis)
└── Features
    ├── Producer (scaffold)
    ├── DJ (library + set builder + harmonic analysis)
    ├── Business (scaffold)
    └── Bar (scaffold)

DJ module data flow:
  Rekordbox XML (.xml) | Traktor export (.nml/.csv)
    -> services/library/parsers.ts   (format sniffing + shared entry point)
    -> services/library/rekordbox.ts (DJ_PLAYLISTS attribute reader)
    -> services/library/parsers.ts   (DOMParser / RFC4180, no upload)
    -> services/library/camelot.ts   (key normalisation + harmonic scoring)
    -> services/library/djRepository (IndexedDB, chunked writes)
    -> features/dj/hooks/useDjLibrary -> DJ module UI
    -> services/library/libraryIndex (compact snapshot)
    -> lib/ai/intents.ts             (JARVIS answers library questions)

DJ launch flow (proposed, see docs/BRIDGE.md):
  DJ launchpad -> features/dj/hooks/useDjBridge -> 127.0.0.1:7420 /health
    -> (not implemented) local helper -> rekordbox.launch | .focus | .status
  The bridge exposes a fixed action allowlist, never a shell command. When it
  is absent the launchpad renders BRIDGE OFFLINE and claims nothing.

Flow:
User (voice or text)
  -> Intent router
     -> desktop action -> store -> desktop
     -> deterministic answer
     -> language model -> /api/jarvis -> provider stream -> assistant panel

The intent router always runs first. Desktop control never depends on a
model, a key, or network access.

## Capability layer

`lib/ai/capabilities/` describes what JARVIS can actually do. It is a
*dictionary*, not a router:

- `lib/ai/intents.ts` still decides which action to run.
- `lib/ai/actions.ts` still executes it and now returns a `CapabilityResult`
  (`capabilityId`, `status`, `ok`, `message`).
- `capabilityForAction()` maps the existing `JarvisAction` union onto registry
  entries. Nothing is generated from model output, and no capability name is
  invented at runtime.

Each descriptor carries a stable id, name, category, `availability`
(`implemented` / `unavailable` / `planned`), `mutatesState`, `destructive`,
`requiresConfirmation`, a safe summary and the action types it owns.

Honesty rules, enforced by `lib/ai/capabilities/__tests__/registry.test.ts`:

- every routed `JarvisAction` maps to exactly one **implemented** capability;
- planned capabilities have no operations and no action types;
- the Rekordbox bridge and DJ hardware are `unavailable`, because no bridge
  ships and controller support is a later phase;
- no capability represents shell execution or arbitrary code.

The `CapabilityResult` contract already includes `denied` and `cancelled` for
future integrations that need consent or long-running work. The deterministic
desktop actions in this build only produce `success`, `failed` or
`unsupported`.

## Telemetry flow

```
JarvisProvider (browser)
  ├── createTurnTrace()  ── monotonic timing per turn
  │     ├── first response token ─► firstResponseMs
  │     ├── search start/terminal ─► search duration
  │     └── finish(completed|failed|cancelled) ─► totalMs
  ├── buildActionEvent(result)  ── real ActionResult.status, never the intent
  └── reporter.record() ──(opt-in checked live)─► POST /api/jarvis/telemetry
                                                     │
                            strict schema + origin check + size cap
                                                     │
                              lib/telemetry/service.ts (Node, server-only)
                                                     │
                         .jarvis-data/telemetry/telemetry.jsonl (+ .1, .2)

GET /api/jarvis/telemetry ── aggregates only ──► Settings → System panel
```

Design constraints:

- **Metadata only.** The persisted record contains an event kind, a capability
  id or search outcome, validated durations, a schema version, a server
  timestamp, an optional provider enum and an allowlisted failure category.
  Prompts, responses, memories, URLs, file paths, keys and raw errors never
  enter the event type, and unknown fields are rejected on ingest.
- **Server-owned storage path.** `JARVIS_DATA_DIR` is environment-only; a
  request can never name a file.
- **Bounded.** 256 KB per file, three files, newest 5 000 records read.
- **Never fatal.** Every write is best-effort; a telemetry failure cannot fail
  a turn.
- **Opt-in.** `settings.localTelemetryEnabled` defaults to `false` and is read
  at send time, so turning it off stops collection immediately.
