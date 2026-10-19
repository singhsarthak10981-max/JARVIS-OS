# AI provider setup

JARVIS OS runs on its built-in **Local Core** with zero configuration. That
core controls the desktop, answers system queries, sets timers and stores
memories — but it is not a conversational language model.

Connecting a real model is optional. This guide covers it.

---

## Where credentials live

**Server-side only.** Keys are read inside `/api/jarvis` from environment
variables. There is no field for them in the UI.

| Rule | Why |
| --- | --- |
| Keys come from `.env.local` or deployment env vars | Never shipped to the browser |
| The browser cannot supply a key | A key in the request body is ignored |
| Keys are never stored in `localStorage` | Older builds did this; see *Upgrading* below |
| Status is reported as booleans only | The UI shows "configured", never the value |

`.env.local` is git-ignored. `.env.example` contains empty placeholders only.

---

## Recommended: Google Gemini

1. **Create a key** — <https://aistudio.google.com/apikey> → *Create API key*.
2. **Add it** to `.env.local` in the project root:

   ```bash
   GEMINI_API_KEY=your-key-here
   ```

   `GOOGLE_GENERATIVE_AI_API_KEY` is accepted as an alias.
3. **Restart** the server. Next.js reads env files at boot:

   ```powershell
   # PowerShell
   # stop with Ctrl+C, then:
   npm run dev
   ```
4. **Verify** — **Settings → Intelligence** → select **Google Gemini** →
   confirm the badge reads **configured** → press **Test connection**.
   The model should be `gemini-3.8-flash`.

A successful test reports the provider and model that actually answered.

---

## Supported providers

| Provider | Variable | Default model |
| --- | --- | --- |
| Google Gemini | `GEMINI_API_KEY` | `gemini-3.8-flash` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| OpenRouter | `OPENROUTER_API_KEY` | `openai/gpt-4o-mini` |
| Ollama | `OLLAMA_BASE_URL` | `llama3.2` |
| Custom (OpenAI-compatible) | `CUSTOM_AI_BASE_URL` | any |

Optional base-URL overrides (server-side only): `OPENAI_BASE_URL`,
`ANTHROPIC_BASE_URL`, `GOOGLE_GENERATIVE_AI_BASE_URL` (alias `GEMINI_BASE_URL`),
`GROQ_BASE_URL`, `OPENROUTER_BASE_URL`, `OLLAMA_BASE_URL`, `CUSTOM_AI_BASE_URL`.

**Base URLs are never taken from the browser when a server key exists.** For a
credentialed provider the endpoint comes only from the environment variable
above or the provider default; the Base URL field in Settings is disabled, and
any value already stored in the browser is ignored — it is never combined with
a server-side key.

For Custom endpoints holding `CUSTOM_AI_API_KEY`, `CUSTOM_AI_BASE_URL` must be
set on the server; a browser-supplied URL is rejected with a configuration
error. Keyless providers (Ollama, Keyless Custom) may still point at a URL, but
cloud metadata addresses (`169.254.169.254`, `metadata.google.internal`, …) are
blocked.

Every model name is editable in Settings. The provider's default is used when
the field is left blank.

---

## Local models with Ollama

No API key needed.

```bash
ollama pull llama3.2
ollama serve
```

Then select **Ollama** in Settings. The base URL defaults to
`http://127.0.0.1:11434/v1`.

JARVIS distinguishes two different Ollama failures:

- **Server unreachable** → "Could not reach Ollama. Check the base URL…"
- **Model not pulled** → a 404 from Ollama, reported as a model error

---

## Web search (Tavily)

Optional. It gives the connected model current information and clickable
source links. Without it, JARVIS says live search is unavailable instead of
presenting stale knowledge as current.

1. **Create a key** — <https://app.tavily.com> → *API Keys* (there is a free
   tier).
2. **Add it** to `.env.local`:

   ```bash
   TAVILY_API_KEY=tvly-your-key-here
   ```

3. **Restart** the server (`Ctrl+C`, then `npm run dev`).
4. **Verify** — **Settings → Intelligence → Web search**. The badge should read
   **configured**, and the toggle should be on.

### When JARVIS searches

Only when one of these is true:

- you explicitly ask — *"search the web for…"*, *"look up…"*, *"google…"*;
- the question is plainly about something that changes — news, releases,
  prices, versions, specs, weather, today's information.

Ordinary conversation, analysis, writing and the deterministic desktop
commands (*open the DJ module*, *set a timer*, *switch theme*, *remember…*)
never trigger a search. The **Live web search** toggle turns the feature off
entirely.

### What leaves your machine

- the focused search query, up to 5 results per query;
- **not** your API keys, your conversation history, or your memories.

The Tavily endpoint is a constant in `lib/ai/search/tavily.ts`. It cannot be
set from Settings, the request body or an environment variable, so a browser
cannot redirect the search key to another host.

### Official-source mode

When you ask for official, primary, vendor or manufacturer sources, JARVIS
restricts the first search to the relevant first-party domains instead of
trusting general web ranking.

A request enters official mode only when it asks for a **source-like artefact**
— documentation, docs, pricing, release notes, specs — *and* mentions official
or primary sourcing. Ordinary conversation that merely contains the word
"official" ("what's the official national dish of Spain?") and creative writing
never trigger it, and the normal search opt-out still applies.

| Vendor / product | Domains used |
| --- | --- |
| Google Gemini API | `ai.google.dev` |
| Google Cloud | `cloud.google.com` |
| OpenAI API | `platform.openai.com` |
| OpenAI announcements | `openai.com` |
| Anthropic / Claude | `docs.anthropic.com` |
| GitHub | `docs.github.com` |
| Microsoft / Azure | `learn.microsoft.com` |
| Apple developer | `developer.apple.com` |
| Spotify developer | `developer.spotify.com` |
| Tavily | `docs.tavily.com` |

The registry lives in `lib/ai/search/official.ts`. Domains are matched exactly
— `ai.google.dev` never matches `ai.google.dev.evil.com`, an arbitrary
subdomain, or a lookalike. When a query names a product, the more specific
domain wins (Gemini → `ai.google.dev`; Google Cloud → `cloud.google.com`;
OpenAI API pricing → `platform.openai.com`; an OpenAI announcement →
`openai.com`).

**Sufficiency.** Official retrieval counts as sufficient only when at least
**two** returned results match a requested first-party host exactly *and* at
least one of them is a documentation or pricing path. A vendor homepage alone
is not enough.

**Controlled fallback.** If official evidence is insufficient, JARVIS runs
**one** broader, unrestricted search. Official results stay first; fallback
results are marked as third-party **secondary** evidence in both the UI and the
model prompt. The application never relabels a third-party source as official,
and it never runs more than two searches for one turn. If the restricted
search itself fails (network, timeout, rejected key), no fallback is attempted —
the failure is reported instead.

**After the fallback.** The final verdict follows the merged, re-validated
evidence, not the fact that a fallback ran:

- If the fallback supplies another first-party docs or pricing page and there
  are no third-party results, the turn is reported as **official sources** —
  adding a fallback result does not make otherwise-sufficient evidence
  "insufficient".
- If official evidence is sufficient but the fallback also found third-party
  results, the turn is **official + secondary**.
- If official evidence is still insufficient — too few first-party results, or
  none of them a documentation/pricing page — the panel says so explicitly and
  the model is told the same. Official links keep their check mark, third-party
  links stay unmarked, and secondary results are never described as filling the
  gap.

**Unknown vendors.** If no first-party domain can be identified from the
request, JARVIS does not invent one. It runs a normal search and tells you that
official-source verification was unavailable. The same message appears in the
assistant panel.

**What the model is told.** In official mode it must prefer the official
sources, keep third-party fallback clearly secondary, cite only supplied URLs,
include the model or product name, unit, currency and conditions only when the
source carries them, give dates only when the evidence has them, and say when
something cannot be verified. It is explicitly told it has only each result's
title, URL and snippet — so it must not claim a fact was "verified against the
page".

**Status labels.** The assistant panel distinguishes a normal live search, an
official-only search, an official search with third-party fallback, a search
with insufficient official evidence, and an unidentified-vendor search. Official
links carry a check mark; secondary links do not.

### What the model sees

Bounded results (title, URL, snippet, optional publication date) inside a
fenced block labelled **untrusted reference data**: the model is told to treat
page contents as evidence, never as instructions, and to cite only the supplied
URLs. If retrieval fails, the model is told to say that live search could not
be completed.

This section applies to official mode too: the official/primary instruction is
added *inside* the same untrusted-evidence model. A retrieved page is still
never treated as an instruction, and its text cannot close the fence.

### Limits

- Up to **five** results per query, `search_depth: basic` (one Tavily credit).
- Official mode uses at most **two** searches per turn (one restricted, one
  optional fallback), so it costs at most two Tavily credits.
- Search is skipped when Local Core is selected — a local core has no model to
  read the sources.
- A search runs before generation, not as an iterative tool loop.

---

## Reading the errors

Failures are classified so you know what to fix without reading server logs.

| Code | Meaning | Fix |
| --- | --- | --- |
| `missing_credentials` | No key on the server for the selected provider | Add the env var, restart |
| `invalid_credentials` | Provider rejected the key | Check the key is active |
| `model_not_found` | Model id wrong or unavailable to the account | Check the model name |
| `rate_limited` | Too many requests | Wait and retry |
| `quota_exceeded` | Plan/billing limit reached | Check billing; retrying won't help |
| `timeout` | Provider didn't respond in time | Check connection, retry |
| `network` | Provider unreachable | Check base URL and network |
| `content_blocked` | Safety filter refused the prompt | Rephrase |

**An explicitly selected provider that cannot be used produces an error.**
JARVIS does not quietly answer with the Local Core and present it as a model
response. Local Core is used only when you select it.

---

## Upgrading from an older build

Earlier versions let you paste a key into Settings and stored it in
`localStorage`. On first load after upgrading:

- the key is **deleted** from browser storage,
- every unrelated setting (provider, model, theme, voice, owner name) is kept,
- nothing is sent anywhere during migration.

You must re-enter the key in `.env.local`.

---

## Testing without a real key

Automated tests use mocked provider responses and assert request shape,
streaming behaviour, cancellation and error classification. They do **not**
prove your account can reach the model — only a live "Test connection" does.

The web-search suites mock Tavily as well. They need **no** API keys, make no
network calls and spend no Tavily credits; a fake `TAVILY_API_KEY` is used only
to assert that the key travels in the authorization header rather than the URL.
