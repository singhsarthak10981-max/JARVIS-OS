# Architecture

JARVIS
├── UI
│   ├── Desktop shell (windows, dock, HUD, palette)
│   └── Assistant panel
├── Router (intent + command palette)
├── Global Store (zustand)
├── AI Core
│   ├── Local intent router
│   ├── Action executor
│   ├── Streaming API route
│   └── Provider adapters (OpenAI-compatible / Anthropic / Gemini)
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
