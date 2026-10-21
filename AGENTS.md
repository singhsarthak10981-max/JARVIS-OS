<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# JARVIS OS — Agent Instructions

JARVIS OS is a personal AI operating system — a tactical-red desktop
environment with an AI assistant, DJ, Producer, Bar and Business
workspaces. It is local-first and single-user: it runs as a Next.js app
on the owner's Windows PC (browser UI + local server on localhost).
There is no cloud backend, no account system, and no paid infrastructure.
Everything must work for free, locally, unless the owner explicitly
configures an optional cloud AI provider.

`CLAUDE.md` simply includes this file (`@AGENTS.md`). This is the single
instruction source for AI coding agents.

## Read before writing code

In this order (per `docs/CONTRIBUTING.md`):

1. `docs/PROJECT_BIBLE.md` — mission, pillars, architecture rules
2. `docs/ARCHITECTURE.md` — capability layer, telemetry flow
3. `docs/DESIGN_SYSTEM.md` — canonical visual system
4. This file
5. Task-specific docs: `docs/MEMORY.md` (long-term memory),
   `docs/AI_SETUP.md` (AI providers and server env), `docs/MULTIMODAL.md`
   (image input), `docs/TESTING.md`, `docs/SECURITY.md`,
   `docs/CODE_STYLE.md`, `docs/VERSIONING.md`, `docs/BRIDGE.md`
   (design-only approval artefact — `tools/bridge/` does not exist and
   must not be built without explicit approval)
6. The relevant guide in `node_modules/next/dist/docs/` for any Next.js
   API you are about to touch. Those bundled docs only exist after
   `npm ci`; if they are unavailable, say so instead of guessing API
   details from memory.

Inspect the existing implementation before editing. Do not invent
modules, scripts, storage keys, or architecture, and do not duplicate
functionality that already exists.

## Stack and commands

- Next.js 16 (App Router, Turbopack), React 19, TypeScript,
  Tailwind CSS 4, Zustand (`lib/store.ts`), framer-motion,
  better-sqlite3 (native addon, server-only).
- `npm run dev` — dev server · `npm run build` — production build ·
  `npm run start` — serve the build
- `npm run lint` (ESLint) · `npm run typecheck` (`tsc --noEmit`) ·
  `npm test` (Vitest) · `npm run test:watch`
- `npm run verify` = lint + typecheck + test. The full quality gate is
  `npm run verify` **and** `npm run build` (see `docs/TESTING.md`).

## Architecture map

- `app/` — App Router shell (`layout.tsx`, `page.tsx`, `globals.css`)
  and route handlers: `app/api/jarvis` (chat streaming; `telemetry`
  sub-route) and `app/api/memory` (facts/skills CRUD, overview/wipe).
- `components/` — reusable UI: `assistant/` (panel, provider, bubbles),
  `modules/` (module windows incl. Settings), `ai/` (orb), `hud/`,
  `window/`, `dock/`, `ui/` (primitives), desktop/sidebar/HUD chrome.
- `features/` — feature-owned code where it exists: today mainly
  `features/dj/` (deck/setlist stores, bridge client, hooks). The other
  feature folders are placeholders; most module UI lives in
  `components/modules/`. Module registry: `lib/modules.ts`
  (command-center, dj, producer, bar, business, settings).
- `services/` — `storage/` (desktop persistence, IndexedDB wrapper),
  `library/` (DJ library repository, track/Rekordbox parsers, Camelot),
  `ai/` (orb sound service).
- `lib/store.ts` — the global Zustand store (settings, windows,
  assistant state). Shared app state lives here, not in components.
- `lib/ai/` — provider metadata (`providers.ts`), server adapters
  (`server.ts`), client transport (`client.ts`), Local Core responder
  (`local.ts`), deterministic intents (`intents.ts`) and desktop
  actions (`actions.ts`), the JARVIS action registry (`capabilities/` —
  app actions, **not** model modalities), model capability metadata
  (`model-capabilities.ts`), web search (`search/`), voice (`voice.ts`),
  errors/types.
- `lib/memory/` — server-side SQLite memory (`db.ts`), prompt-context
  selection (`context.ts`), chat wiring (`chat.ts`), secret guard
  (`guard.ts`), reflection proposals (`proposals.ts`). Server-only:
  import only from route handlers / server code.
- `lib/telemetry/` — opt-in, local-only turn telemetry.
- `docs/` — canonical documentation set; `docs/Progress/<version>/`
  holds per-release notes/screenshots.

## Data stores — never merge, migrate, or silently move them

Three distinct stores exist on purpose. Do not unify them, change their
keys/formats, or copy data between them without explicit owner approval:

1. **Browser localStorage** — `jarvis-memory-v1` (pinboard facts,
   ≤200), `jarvis-conversation-v1` (browser chat copy, ≤60 messages),
   `jarvis-settings-v1`, `jarvis-desktop-state` (UI only),
   `jarvis-activity-v1`, `jarvis-dj-decks-v1` (track ids only).
2. **Server SQLite** — `jarvis-memory.db` under `JARVIS_DATA_DIR`
   (default `<checkout>/.jarvis-data/memory/`, git-ignored): facts,
   skills, conversations, messages, audit log (capped at 1,000 rows).
   Manual export exists via `GET /api/memory?include=…`; there is no
   cloud sync.
3. **Browser IndexedDB** — DJ library data (`services/library`).

Non-persistence is also by design: uploaded documents are read
transiently (`lib/local-files`), and attached images are ephemeral
(never persisted, logged, or sent anywhere except the current turn's
provider call — see `docs/MULTIMODAL.md`).

## Privacy and provider boundaries (do not weaken)

- Server SQLite facts/skills are injected **only** into local Ollama
  calls (the chat route passes `inject` only when the provider is
  Ollama), and reflection learning is Ollama-only — a cloud model is
  never asked to process an exchange for learning. Pinboard memories go
  to the user-selected provider after server-side relevance selection
  (≤8 facts; explicit recall ≤25). This split is deliberate.
- `memoryEnabled: false` (Settings → Memory bank) stops memory
  injection (both stores), reflection learning, saving new facts
  (intent layer **and** action executor), and recall listing — and
  deletes nothing. Conversation persistence continues. `JARVIS_MEMORY=off`
  is the separate full server-side stop. Never word UI copy as if
  disabling memory deletes history or facts.
- The model must never delete or wipe memory on its own; wipes are
  user-confirmed operations, and secret-shaped content is refused at
  write time and filtered again at injection (`lib/memory/guard.ts`).
- API keys and secrets live only in `.env.local` or the appropriate
  server environment — never in the repository. `.env.example`
  documents environment-variable names and placeholders only and must
  never contain real secrets (full server env surface in
  `docs/AI_SETUP.md`). Keys never reach the browser, and provider
  base URLs are never taken from the browser when a request will
  carry a server key. Do not change credential resolution or weaken
  base-URL/SSRF guards.
- Never silently switch provider or model, never fall back to Local
  Core and present it as a model, and never silently drop user input
  (e.g. images on a text-only model refuse loudly with
  `unsupported_modality`). The 8 provider ids (`local`, `openai`,
  `anthropic`, `google`, `groq`, `openrouter`, `ollama`, `custom`) are
  stable API.
- `lib/ai/model-capabilities.ts` is the only authority on what a model
  can accept. Unknown models are text-only; Local Core is always
  text-only. Capability claims must be verified against official
  provider documentation before being added.
- Telemetry is opt-in and local, and records turn metadata only — the
  event type has no field for prompts, replies, memories, file
  contents, or keys. Keep it that way.

## Design system

`docs/DESIGN_SYSTEM.md` is canonical; `lib/tokens.ts` + Tailwind
`jarvis-*` utilities implement it. Matte black surfaces, tactical red
accent (`#E50000`), glass panels, small operational typography,
purposeful animation (framer-motion), minimal clutter. Reuse existing
components and tokens; do not introduce arbitrary one-off styling. A
new shared semantic token may be added when genuinely necessary,
provided `docs/DESIGN_SYSTEM.md` is updated in the same change. The
UI must never fabricate state: unknown is "unknown" (not "running"),
missing data shows an explicit empty state. Before
describing or surfacing any capability (e.g. audio, video, image
generation, the desktop bridge), inspect the actual implementation
and distinguish implemented, partial and unavailable functionality —
never present a placeholder or incomplete integration as working.

## Change discipline

- Small, focused, verifiable changes. Inspect first; prefer the
  existing pattern in the file you are touching; preserve working
  functionality — a feature is not done if an adjacent one regressed.
- No new dependencies, paid services, or cloud providers without
  explicit owner approval. Prefer extending existing HTTP adapters and
  façades over adding SDKs or parallel implementations.
- Product decisions that change data, privacy, or memory semantics
  require explicit owner approval **before** implementation. When a
  consequential decision cannot be resolved from the repository, ask —
  briefly, with options — instead of guessing.
- Never remove the workspace-root pinning or
  `serverExternalPackages: ["better-sqlite3"]` in `next.config.ts`;
  both are load-bearing (the comments there explain why).
- Keep files small and strongly typed (per `docs/PROJECT_BIBLE.md`).
  Avoid broad search-and-replace; review the full diff of your change
  before finishing.
- When a change affects documented behavior — storage keys, data
  limits, provider/privacy boundaries, or memory semantics — update
  the relevant `docs/` files (and this file, if its summary is
  affected) in the same change.

## Testing and verification

- Tests are Vitest + jsdom, colocated in `__tests__/` folders. Mock the
  network: no live provider calls and no real API keys in tests or CI.
- Behavior changes need tests. Match existing conventions (route tests
  mock `fetch`; component tests use static rendering; memory tests use
  temp dirs via `JARVIS_DATA_DIR`).
- Before opening a PR run, and report the real results of:
  - `npm run verify` (exit code + test/file counts)
  - `npm run build` (exit code)
- `better-sqlite3` is a native addon: if a sandbox blocks node-gyp
  header downloads, install with `npm ci --ignore-scripts` and fetch
  its prebuild (`npx prebuild-install` inside
  `node_modules/better-sqlite3`). Never commit `node_modules` or
  `.jarvis-data`.
- GitHub Actions (`.github/workflows/ci.yml`) runs `npm run verify`
  and `npm run build` on push/PR. A green local run is still required
  first — do not use CI as the first test run.

## Git and pull requests

- Work on a feature branch; open PRs against `master`; **never merge a
  PR automatically** and never commit directly to `master`.
- Conventional-style commit subjects (see `docs/CONTRIBUTING.md`):
  `feat: …`, `fix(memory): …`, `docs: …`. Releases follow
  `docs/VERSIONING.md` + `docs/CHANGELOG.md` +
  `docs/Progress/<version>/` (never fabricate screenshots).
- Never reset, force-push, `git clean`, drop stashes, or otherwise
  discard existing work — including the owner's local branches and
  backups — as a shortcut. If the tree is dirty with work that is not
  yours, stop and report it.
- Keep PRs reviewable: one concern, tests included, diff reviewed in
  full. Do not bump the `package.json` version except as part of a
  release task.

## Safe AI autonomy

- Act autonomously on reversible, in-scope implementation work —
  including starting a local development/test server as part of an
  authorized task. Stop and ask before: destructive operations (data
  deletion/wipe, branch deletion), anything requiring credentials you
  were not given, spending money, consequential system changes, or
  anything that autostarts or persists as a background service (the
  desktop bridge in `docs/BRIDGE.md` always requires explicit approval
  to build or run).
- Never enter, print, or commit secrets. If a check or operation
  cannot be performed (permissions, environment, missing tools), say
  exactly that — never report success for something that did not run.

## Completion reports (required)

End every task with a report containing:

1. **Changed files** — the exact list, and what changed in each.
2. **Checks actually run** — commands, exit codes, and real test/file
   counts (before/after when relevant). Distinguish automated tests
   from manual/smoke verification, and mocked from live providers.
3. **Not verified / unresolved** — anything skipped, blocked, or known
   to remain (limitations, follow-ups, decisions needing the owner).
4. **Git state** — branch, commit SHA, PR link and status (never
   "merged" unless GitHub confirms it).
