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
logged, and a bulk wipe does not leave a fresh entry behind).

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
curl -X DELETE 'localhost:3000/api/memory?scope=facts'         # facts | skills | conversations | log
curl -X DELETE 'localhost:3000/api/memory?scope=all&confirm=true'  # everything
```

`scope=all` requires `confirm=true` so a stray call cannot wipe the whole
memory. Conversations are written via the data layer
(`createConversation` / `appendMessage` in `lib/memory/db.ts`); there is
intentionally no public POST route for them yet.

## Notes

- **Search is `LIKE`-based** (wildcards escaped). At personal scale (hundreds
  of facts) this is instant. If the store grows large, add an FTS5 virtual
  table over `facts(key, value)` without changing the API.
- The connection runs in WAL mode with foreign keys on; `getDb()` caches one
  handle per server process (survives `next dev` reloads via `globalThis`).
- Tests: `lib/memory/__tests__/db.test.ts` runs against `:memory:` databases.
