# Stark Interface Sprint

**Goal:** evolve JARVIS from a conventional dashboard into a cinematic, instrument-like desktop OS while preserving working desktop behavior and honest capability status.

## Visual direction

- Graphite / midnight-blue depth, cyan instrumentation and cool-white labels.
- Preserve Tactical Red, Arc Reactor and Stealth as selectable themes.
- One visual language: thin instrument borders, restrained bloom, layered radial/arc geometry, measured motion, and high-contrast state.
- AI-core, ambient arc, HUD status and cursor colors follow the selected theme.
- Never render a connection as healthy because of decoration; status color and accessible text must come from real/qualified state.

## Milestone scope

1. **Stark Interface theme**
   - Available through Settings → Interface.
   - Used as the default for fresh settings only; existing explicit preferences are preserved.
   - Voice aliases: “Stark”, “Stark Interface”, “Iron Man”, and “Jarvis blue”.
2. **Reticle cursor**
   - Runs only on fine-pointer devices.
   - Pointer-events are disabled on the reticle.
   - Text fields retain text cursors; native touch interaction stays intact.
   - Respect reduced motion and leave keyboard navigation usable.
3. **Edge-reveal sidebar**
   - Auto-hides just beyond the left edge, leaving a slim activation tab.
   - Reveals on pointer entry and hides on pointer exit.
   - Has a clear pin control and Ctrl/Cmd+B keyboard shortcut.
   - Closed content is hidden from the accessibility tree and cannot receive focus.
4. **Theme coherence**
   - Ambient arc, AI core, rings, glow, assistant status and HUD state colors should use theme variables instead of hard-coded red.
5. **Visual review and tests**
   - Run `npm run verify` and `npm run build`.
   - Inspect 1920×1080, 1440×900 and 1366×768 in browser responsive mode.
   - Verify sidebar hover/pin behavior, reticle on controls and text inputs, all themes, reduced-motion settings, and keyboard-only navigation.
   - Capture screenshots and a short interaction clip under `docs/progress/` before tagging the release.

## Out of scope for this visual milestone

- Unrestricted filesystem access.
- Starting desktop apps through a native process.
- OAuth or external integration credentials.
- Arbitrary shell commands or silent autostart.

Those belong to the separate, permission-gated plan in [INTEGRATIONS_ROADMAP.md](./INTEGRATIONS_ROADMAP.md).

## Definition of done

- `npm run verify` and `npm run build` pass on the local Windows checkout.
- The three target viewport sizes are visually inspected.
- Sidebar reveals/hides predictably, its controls are keyboard-accessible, and it does not cover the Top HUD.
- Reticle doesn't block clicks or text editing and is absent on touch-only devices.
- Theme colors remain coherent in the AI core, ambient arcs and system indicators.
- Capability registry and integrations documentation make no false claims.
- Commit is reviewed, merged, and tagged only after local validation.
