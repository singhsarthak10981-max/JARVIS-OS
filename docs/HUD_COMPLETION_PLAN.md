# JARVIS HUD Completion Plan

## Goal
Complete and stabilize the JARVIS OS HUD before building the Producer application.

## Sequence
1. Top HUD — hierarchy, status affordances, notifications, responsive behavior.
2. Sidebar — collapse/expand, persisted state, tooltips, workspace context, keyboard UX.
3. Dock — active/minimized states, tooltips, pinned vs running distinction, responsive behavior.
4. Command Center — production-ready layout and interaction hierarchy without coupling it to future Producer data.
5. Desktop/HUD integration — workspace indicators, background cohesion, window integration, responsive behavior.
6. Regression and polish — interaction, accessibility, performance, production build.

## Rules
- Preserve the Sprint 6D window architecture.
- Do not reintroduce the Design Arena stash wholesale.
- Keep OS state separate from future domain state.
- Prefer existing design tokens over scattered values.
- Red is used primarily for state and hierarchy, not decoration.
- Build after each milestone.

## Definition of Done
- Top HUD, Sidebar, Dock, Command Center and desktop HUD behave coherently.
- Window/workspace interactions remain intact.
- Desktop targets remain usable at 1920x1080, 1440x900 and 1366x768.
- `npm run build` passes.
- HUD milestone is committed and tagged before Producer development begins.
