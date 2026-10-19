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
    ├── DJ (scaffold)
    ├── Business (scaffold)
    └── Bar (scaffold)

Flow:
User (voice or text)
  -> Intent router
     -> desktop action -> store -> desktop
     -> deterministic answer
     -> language model -> /api/jarvis -> provider stream -> assistant panel

The intent router always runs first. Desktop control never depends on a
model, a key, or network access.
