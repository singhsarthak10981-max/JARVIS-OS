# Testing

Run the full gate before pushing:

```bash
npm run verify   # eslint + tsc --noEmit + vitest
npm run build    # production build (also typechecks)
```

No step needs a real API key, a network connection or provider credits.

---

## What the suite covers

| Area | Files |
| --- | --- |
| Intent routing, timers, memory, themes, math | `lib/ai/__tests__/intents.test.ts`, `math.test.ts` |
| Deterministic action results and the capability registry | `lib/ai/capabilities/__tests__/registry.test.ts`, `lib/ai/__tests__/intents.test.ts` |
| Provider adapters, error classification, local core | `lib/ai/__tests__/server.test.ts`, `base-url-security.test.ts`, `reply-policy.test.ts` |
| Web search decision, Tavily client, official-source mode | `lib/ai/search/__tests__/*.test.ts` |
| Route-level streaming, search and telemetry | `app/api/jarvis/__tests__/*.test.ts` |
| Assistant UI (messages, search status, diagnostics) | `components/**/__tests__/*.test.tsx` |
| Assistant telemetry instrumentation | `components/assistant/__tests__/telemetry-instrumentation.test.tsx` |
| Telemetry schema, timing, storage, aggregates | `lib/telemetry/__tests__/*.test.ts` |
| DJ library, persistence, deck assignment | `features/dj/__tests__`, `services/**/__tests__`, `lib/__tests__` |

## How external services are kept out

- **Providers** are mocked at `fetch`. Streaming tests feed hand-built SSE/NDJSON
  frames. No request leaves the machine.
- **Tavily** is mocked the same way; tests assert the request shape
  (`include_domains`, `max_results`, headers) without calling it. Keys used in
  tests are obvious fakes and are only checked for placement, never printed.
- **Telemetry** tests set `JARVIS_DATA_DIR` to a `mkdtemp()` directory. They
  never read or write the developer's `.jarvis-data/`, and the directory is
  removed afterwards.
- **The assistant provider test** mounts the real `JarvisProvider` in jsdom with
  a mocked transport, so turn timing, cancellation and failure paths are
  exercised end to end without a model.

## Telemetry-specific expectations

`lib/telemetry/__tests__/service.test.ts` asserts the privacy and storage
contract directly:

- a record contains only allowlisted metadata (no prompt, response, memory,
  URL, key or path);
- unknown fields, unknown capability ids, negative/fractional/absurd durations
  and a first response later than the turn's total are rejected;
- storage rotates at 256 KB across at most three files;
- an unwritable directory returns a safe failure instead of throwing;
- aggregates return `null` (not `0`) when nothing has been measured, and the
  action success rate exposes its denominator.

`components/assistant/__tests__/telemetry-instrumentation.test.tsx` asserts that
turning telemetry off sends **nothing**, that a failed or cancelled stream is
recorded with a safe category, that raw error text never reaches the payload,
and that a down telemetry endpoint does not disturb the reply.

---

## v1.0.0 quality gate

```bash
npm run lint
npm run typecheck
npm test
npm run build
# or simply
npm run verify
```

GitHub Actions currently runs `npm run build`. Add lint/typecheck/test steps to
`.github/workflows/ci.yml` from a token with `workflows` permission to gate pull
requests on the full suite.
