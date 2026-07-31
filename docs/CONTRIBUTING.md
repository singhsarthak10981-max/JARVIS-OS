# JARVIS OS Contribution Guide

Version: 1.0

This document defines the engineering standards for JARVIS OS.

## Philosophy

Build for maintainability, modularity, scalability, and consistency.
Architecture always takes priority over shortcuts.

## Project Structure

```
app/
components/
features/
services/
hooks/
lib/
types/
data/
docs/
public/
```

### Rules
- Components contain UI only.
- Services contain business logic.
- Features contain complete modules.
- Hooks contain reusable React hooks.
- Lib contains shared utilities and stores.

## Design System

Never hardcode colors, spacing, shadows, radii, animation timings or typography.

Always use `lib/tokens.ts`.

## State Management

- Global state → Zustand
- Local state → useState
- Never duplicate state.

## Styling

- Tailwind CSS
- Framer Motion for animations
- Avoid inline styles unless required.

## Architecture

UI → Service → Store → UI

Business logic belongs in services.

## AI Coding Agents

Before writing code:

1. Read PROJECT_BIBLE.md
2. Read ARCHITECTURE.md
3. Read DESIGN_SYSTEM.md
4. Read AGENTS.md

Do not invent architecture or duplicate existing functionality.

## Git Workflow

Architecture Review → Implementation → Build → Testing → Commit → Tag → Push → Release Notes

## Commit Examples

- feat: window manager
- feat: notification center
- fix: orb animation
- refactor: router
- docs: roadmap update

Release commits:
- v0.6.0 - Desktop
- v0.7.0 - Voice

## Testing Checklist

- npm run build
- Zero TypeScript errors
- Zero ESLint errors
- No console errors

## Definition of Done

- Feature works
- Build passes
- Documentation updated
- Git committed
- Tagged (release)
- Pushed to GitHub

## Final Principle

Write code as if someone else will maintain it in five years.
