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
  Traktor export (.nml/.csv)
    -> services/library/parsers.ts   (DOMParser / RFC4180, no upload)
    -> services/library/camelot.ts   (key normalisation + harmonic scoring)
    -> services/library/djRepository (IndexedDB, chunked writes)
    -> features/dj/hooks/useDjLibrary -> DJ module UI
    -> services/library/libraryIndex (compact snapshot)
    -> lib/ai/intents.ts             (JARVIS answers library questions)

Flow:
User (voice or text)
  -> Intent router
     -> desktop action -> store -> desktop
     -> deterministic answer
     -> language model -> /api/jarvis -> provider stream -> assistant panel

The intent router always runs first. Desktop control never depends on a
model, a key, or network access.
