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

### What the model sees

Bounded results (title, URL, snippet, optional publication date) inside a
fenced block labelled **untrusted reference data**: the model is told to treat
page contents as evidence, never as instructions, and to cite only the supplied
URLs. If retrieval fails, the model is told to say that live search could not
be completed.

### Limits

- Up to **five** results per query, `search_depth: basic` (one Tavily credit).
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
