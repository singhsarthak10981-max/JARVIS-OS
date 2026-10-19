# Changelog

All notable changes to JARVIS OS are documented here.

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