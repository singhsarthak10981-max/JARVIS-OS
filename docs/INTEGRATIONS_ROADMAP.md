# JARVIS OS Integration Roadmap

**Status: planning.** Items below are proposals until a working adapter, meaningful tests, and honest capability-registry state have been merged. A settings panel or mock status alone does not count as an integration.

## Current baseline

| Capability | Current status | Boundary |
| --- | --- | --- |
| Conversational AI | Implemented | Local Core works without credentials; remote providers need server-side configuration. |
| Live web search | Implemented | Requires `TAVILY_API_KEY`; returned sources are evidence, not a guarantee of accuracy. |
| Imported DJ library queries | Implemented | Answers from the imported local collection snapshot; no direct Rekordbox database writes. |
| Rekordbox launch / desktop apps | Unavailable | The local bridge is design-only; no helper is shipped or running. |
| Local file browsing | Planned | No arbitrary filesystem access is available to the web UI. |
| Calendar, weather, email, smart home | Planned | No provider connection or account authorization is currently implemented. |

Canonical source of truth: `lib/ai/capabilities/registry.ts`. Keep it updated with code and tests; never mark an item implemented just because a control exists.

## Phase A — Safe local-file access

1. Start with **user-picked, read-only imports**: choose a file or a directory explicitly from a button press; show the chosen item and the exact permitted operation before reading.
2. Prefer metadata and preview first. Add a bounded text reader for supported formats before any indexing. File contents stay local unless the user explicitly submits selected text to a configured AI provider.
3. Use the browser File System Access API where supported, with a clearly-labelled fallback such as `<input type="file">` for file imports. Directory-picker availability varies by browser; `showDirectoryPicker()` requires secure context and transient user activation. It must not be called automatically on page load.
4. Never scan an entire drive, follow symlinks recursively, execute a file, start a program, or write/delete/rename files in the first milestone.
5. Add permission-denied, user-cancelled, oversized-file, unsupported-format, and permission-revoked tests. Report access as unavailable if the browser cannot supply the feature.

Implementation notes:
- Store no file contents in telemetry. Paths and file names are sensitive and must not be included in operational logs.
- If handles are persisted, keep persistence explicit and re-check permission on every session.
- Start with file-picker imports for beat notes, lyrics, and project reference text. Directory crawling is a later milestone.

References:
- [MDN: File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
- [MDN: Window.showDirectoryPicker()](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)

## Phase B — Low-risk external read-only integrations

**Proposed order: weather, then calendar read-only, then email read-only.**

### Weather
- Add an adapter that returns a validated forecast shape and timestamp/source metadata.
- A missing key, network error, or stale response must result in an explicit unavailable state—never invented weather.
- Keep location use explicit: allow a user-configured city or a one-time user-approved location request; do not silently infer exact location.
- Tests should cover malformed provider data, timeouts, cache age, and unit conversions.

### Calendar read-only
- Start with list/read-only scope; no creating, changing or deleting events in the first milestone.
- Use standard OAuth authorization and the provider's narrowest scopes. Do not request full calendar write access for a read-only assistant.
- Keep tokens server-side where an appropriate authenticated server session exists; never put refresh tokens in `localStorage`, desktop snapshots, logs, or telemetry.
- Distinguish "connected", "needs reauthorization", "permission denied", and "service unreachable".

Reference: [Google Calendar API authentication and scopes](https://developers.google.com/workspace/calendar/api/auth)

### Email read-only
- Begin with sender, subject, timestamp, and unread state; opening message bodies is a separate explicit permission decision.
- Use the narrowest supported OAuth scope. Gmail's read-only scope is restricted and may carry additional verification and security-assessment requirements for applications that store or transmit restricted-scope data. Decide on the deployment model before requesting access.
- No send, archive, delete, forward, label changes, or attachment downloads in the initial integration.
- Do not log message bodies, subjects, addresses, or tokens in telemetry.

Reference: [Google Gmail API authentication and scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

## Phase C — Explicit desktop bridge

The bridge is **not implemented** and remains governed by `docs/BRIDGE.md`.

- No desktop helper should start during this visual sprint.
- The proposed helper must bind to loopback only, authenticate requests, validate a small fixed action allowlist, reject unknown fields, rate-limit requests and expose observable status.
- Never accept arbitrary shell commands, executable paths, file paths, or script text from the browser.
- No autostart by default. Creation and first manual run/testing remain explicit approval gates.
- First possible actions are status and launching/focusing named approved applications (e.g. Rekordbox), not arbitrary system control.
- The UI must say `BRIDGE OFFLINE` until it receives a real authenticated response.

Reference: [Local Bridge design and approval gates](./BRIDGE.md)

## Phase D — Smart home and write-capable actions

Only after read-only integrations have well-tested permissions and connection lifecycles:
- use an authenticated adapter with per-device allowlists;
- preview the intended action and require confirmation for unlock, alarm, power, financial, deletion, sending, or other consequential writes;
- support cancel/deny/timeout as first-class outcomes;
- record aggregate operational outcomes only, with opt-in telemetry and no payloads/secrets.

## Definition of done for every adapter

- A capability entry accurately says implemented, unavailable, or planned.
- Setup and disconnect flows exist, with non-secret configuration state only.
- All provider payloads are runtime-validated before use.
- Permission denial, revocation, timeout, malformed responses and offline state are tested.
- Tokens and private data are not exposed to client logs, telemetry, or snapshots.
- Tests prove failures are not presented as successes.
- Documentation names required permissions, supported actions, and known limitations.
