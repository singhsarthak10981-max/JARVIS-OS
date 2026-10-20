# Long-term memory (SQLite)

Jarvis keeps two kinds of state, deliberately separate:

| State | Where | Contents |
|---|---|---|
| UI state | browser `localStorage` (`jarvis-desktop-state`, `jarvis-memory-v1`) | windows, shortcuts, wallpaper, in-browser notes |
| Long-term AI memory | server SQLite — `.jarvis-data/memory/jarvis-memory.db` | facts, conversations, learned skills, audit log |

The SQLite database is **server-only**: `lib/memory/db.ts` starts with
`import "server-only"`, so importing it into a client component fails the
build. All access goes through the API routes below. The file lives under
`JARVIS_DATA_DIR` (default `<checkout>/.jarvis-data`, git-ignored) and never
leaves the machine. Delete the file to start completely fresh.

## Schema

```sql
facts          id, key (UNIQUE), value, category, source, created_at, updated_at
conversations  id, title, created_at, updated_at
messages       id, conversation_id → conversations(id) ON DELETE CASCADE,
               role ('user'|'assistant'|'system'), content, created_at
skills         id, name (UNIQUE), description, steps (JSON array of strings),
               times_used, last_used, created_at, updated_at
memory_log     id, action ('read'|'search'|'write'|'delete'|'use'),
               entity_type, entity_id, detail, created_at
```

Timestamps are ISO-8601 UTC strings. Facts are upserted by `key` and skills
by `name`, so re-saving updates in place. Every fact/skill read, search,
write and delete is recorded in `memory_log` (reading the log itself is not
logged, and a bulk wipe does not leave a fresh entry behind). The log keeps
only the newest 1,000 rows, and search queries that look like secrets are
recorded as `[redacted]`.

## API

All routes are `runtime = "nodejs"`, return JSON, and validate their input.
Errors are `{ "error": "..." }` with status 400/404.

### Facts

```bash
# Teach (or update) a fact
curl -X POST localhost:3000/api/memory/facts -H 'content-type: application/json' \
  -d '{"key":"coffee","value":"oat flat white","category":"preferences"}'

# List / search (q matches key + value, case-insensitive)
curl 'localhost:3000/api/memory/facts?q=coffee'
curl 'localhost:3000/api/memory/facts?category=preferences&limit=20'

# One fact, then delete it
curl localhost:3000/api/memory/facts/1
curl -X DELETE localhost:3000/api/memory/facts/1
```

`POST` returns `{ fact, created }` — `created` is `true` when the `key` was
new, `false` when an existing fact was overwritten.

### Skills

```bash
# Teach a procedure
curl -X POST localhost:3000/api/memory/skills -H 'content-type: application/json' \
  -d '{"name":"brew-coffee","description":"Kalita pour-over",
       "steps":["Boil water to 93°C","Bloom 45s with 50g","Pour to 300g total"]}'

# Search skills
curl 'localhost:3000/api/memory/skills?q=coffee'

# Get it, record one use (times_used + 1, last_used = now), delete it
curl localhost:3000/api/memory/skills/1
curl -X POST localhost:3000/api/memory/skills/1
curl -X DELETE localhost:3000/api/memory/skills/1
```

Re-`POST`ing a skill with the same `name` replaces its description/steps but
keeps `times_used` and `last_used`.

### Review & delete everything

`GET /api/memory` returns counts plus the stored contents — this is the
endpoint a Settings → Memory panel should use to show the user everything
Jarvis remembers:

```bash
curl localhost:3000/api/memory                       # everything
curl 'localhost:3000/api/memory?include=facts,log'   # subset
curl 'localhost:3000/api/memory?limit=25'            # per-section limit
```

Deletes (responds with how many rows were removed):

```bash
curl -X DELETE 'localhost:3000/api/memory?conversation=3'      # one conversation + its messages
curl -X DELETE 'localhost:3000/api/memory?scope=facts&confirm=true'  # facts | skills | conversations | log
curl -X DELETE 'localhost:3000/api/memory?scope=all&confirm=true'    # everything
```

Every scoped wipe requires `confirm=true` so a stray (or model-hallucinated)
call cannot bulk-delete memory; deleting a single item needs no confirmation.
Conversations are written via the data layer
(`createConversation` / `appendMessage` in `lib/memory/db.ts`); there is
intentionally no public POST route for them yet.

## How chat uses memory

`/api/jarvis` is wired into this store (server-side only, fail-soft: if the
database cannot be opened, chat simply runs without memory):

- **Persistence.** Every completed exchange is appended to a conversation.
  Turns the client handled locally (desktop actions, canned answers) are
  backfilled from the history it sends, anchored on the last stored
  message so nothing duplicates. A conversation idle for 30 minutes
  rotates to a new one. Errored turns are not stored.
- **Retrieval.** Before a reply, facts/skills are keyword-scored against
  your last messages and the best matches are injected into the system
  prompt — at most 8 facts and 3 skills in a 1,200-character block, and
  **only when the provider is Ollama**, so the prompt stays on your
  machine. Nothing relevant → nothing injected. The prompt also tells
  the model to say a detail is not stored rather than guess, and to
  attribute answers that come from memory; automatically learned
  entries carry an `[inferred]` marker.
- **Pinboard selection.** The browser pinboard (`jarvis-memory-v1`) used
  to be injected wholesale (up to 30 entries, every provider). It is now
  relevance-selected with the same deterministic scoring: meaningful
  query terms (accent- and case-folded, so "café" matches "cafe", and
  tokens like "r&b" survive intact), strongest matches first, recency
  breaking ties, at most **8** — an unrelated turn sends none, and the
  limit is never padded with unrelated facts. This applies to every
  adapter (Gemini included); the SQLite store still never leaves the
  machine. Explicit recall ("what do you remember?") is separate from
  this prompt set: it lists up to 25 entries and points at
  Settings → Memory bank for the rest.
- **Learning (reflection).** After each reply, a **local** model reviews
  the exchange off the response path and may propose updates as JSON.
  Reflection runs through Ollama only — never a cloud provider, even when
  the reply came from one; if no local model is reachable it is skipped
  and the reason is logged. Proposals auto-apply only when they are
  high-confidence with a stated reason; transient details, speculation
  and sensitive data are refused by policy and secrets by the same filter
  as the write API; skills require explicit teaching; a value that
  conflicts with an existing fact is skipped unless marked as a
  correction. Everything learned lands with `source: "inferred"` and its
  reason in `memory_log` — review it with `GET /api/memory`.
- **Kill switch.** `JARVIS_MEMORY=off` disables retrieval, injection,
  reflection, learning and conversation persistence. It does **not**
  erase anything: existing rows stay reviewable and deletable through
  this API (the management routes above are unaffected by the switch).
- **Settings toggle.** Settings → Memory bank → "Use saved memory"
  (on by default, including for installations that predate it) is the
  user-facing switch. Off stops: injection of pinboard **and** SQLite
  memory into prompts, saving new facts ("remember that…" is honestly
  refused), explicit recall (it explains instead of listing facts), and
  reflection learning. It deletes nothing — stored memories stay
  reviewable and deletable, forgetting stays available, and
  **conversation history is not saved memory**, so persistence
  continues; `JARVIS_MEMORY=off` remains the only full stop.
- **Reflection model.** When the main provider is not Ollama, reflection
  uses `JARVIS_MEMORY_MODEL` if set, else the Ollama default model. With
  only the Local Core (no Ollama running), reflection is skipped.

Two memory stores deliberately coexist for now: the browser pinboard
(`jarvis-memory-v1`, managed in Settings; when memory is off the client
sends none of it) and this database (auto-learned, relevance-injected).
Retrieval dedupes against the pinboard so the same note is not injected
twice, and nothing is migrated, copied, or deleted between them
automatically. Known gap: "what do you remember?" is still answered
from the pinboard only — unifying that is left to a future PR. The
Settings → Memory bank list shows every pinboard entry (scrollable),
so all of them stay individually reviewable and deletable.

> The local-only guarantee depends on this backend and the SQLite file
> running on your own machine. If the backend ever moves to a remote
> host, re-evaluate injection, reflection and storage before enabling
> memory there.

## Notes

- **Secrets are refused at write time.** POSTs are scanned for card numbers
  (Luhn-checked, so order numbers pass), known API-key/token shapes,
  `password: …`-style assignments, JWTs and private-key headers. A match
  returns 400 and nothing is stored or logged. It is a heuristic guardrail,
  not a vault — real credentials belong in a password manager.
- **Search is `LIKE`-based** (wildcards escaped). At personal scale (hundreds
  of facts) this is instant. If the store grows large, add an FTS5 virtual
  table over `facts(key, value)` without changing the API.
- The connection runs in WAL mode with foreign keys on; `getDb()` caches one
  handle per server process (survives `next dev` reloads via `globalThis`).
- Tests: `lib/memory/__tests__/db.test.ts` runs against `:memory:` databases.
