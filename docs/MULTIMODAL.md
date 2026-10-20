# Multimodal: image input

JARVIS can send images to vision-capable models. This document describes how
model capabilities are decided, how an attached image travels through the
system, what was verified in the initial catalog, and what the known
limitations are.

Only **image input** (understanding) is implemented. Audio input/output, video
input and image generation are designed for but **not implemented**, and are
never presented as working.

---

## Model capabilities

`lib/ai/model-capabilities.ts` is the single authority on what a model can
accept. It is deliberately **not** part of `lib/ai/capabilities/` (that
registry describes JARVIS's own desktop actions) and contains no credentials
or availability data — capability and availability are different concepts, and
only capability lives here.

Each lookup returns:

- `textInput`, `textOutput` — always true for chat models
- `imageInput` — the only extra modality implemented today
- `audioInput`, `audioOutput`, `videoInput`, `imageGeneration` — **false for
  every model** until those features exist
- `maxImages` — a provider-documented per-request image cap, where recorded
- `known` — whether any catalog entry matched

Rules:

- **Unknown models are text-only.** Any doubt resolves to text-only; the UI
  says so ("isn't a known vision model") instead of guessing.
- **Local Core is always text-only**, whatever model id it is given. It never
  pretends to have seen an image.
- **Custom endpoints are text-only** — there is no catalog for arbitrary
  self-hosted models, so images are blocked rather than sent on a guess.
- Lookup is per-provider: an OpenAI model id typed into the Anthropic slot
  grants nothing.
- Matching is exact-id first, then longest-prefix, with snapshot dates
  (`gpt-4o-2024-11-20`) and casing normalized away. Longer prefixes override
  broader families, so `gemini-embedding` (text-only) beats the blanket
  `gemini-` vision grant.

### Verified initial catalog (October 2026)

Verified against official provider documentation, not assumptions:

| Provider | Vision (examples) | Notes |
| --- | --- | --- |
| OpenAI | `gpt-4o`, `gpt-4.1`, `gpt-5` families, `o3`, `o4-mini` | `o3-mini`/`o1-mini`, audio/realtime/search/TTS variants are text-only |
| Anthropic | Claude 3 and later (Sonnet, Opus, Haiku) | Legacy Claude 2 / Instant excluded |
| Google | Gemini chat models (e.g. `gemini-3.8-flash`) | `gemini-embedding-*` explicitly text-only |
| Groq | `qwen/qwen3.8-27b` (max 3/request), `meta-models/muse-spark-open` (max 5) | Everything else on Groq is text-only today, including the `llama-3.3-70b-versatile` default |
| OpenRouter | Vendor vision families (`openai/gpt-4o*`, `anthropic/claude-*`, `google/gemini-*`, …) plus named open vision models (Llama 3.2 Vision, Qwen2.5-VL, Gemma 3, Mistral Small 3.1, Kimi-VL) | Proxied vendor models inherit vendor verification |
| Ollama | `qwen3-vl`, `qwen2.5vl`, `llama3.2-vision`, `llama4`, `gemma4`, `gemma3` (4b/12b/27b only), `llava`, `moondream`, `minicpm-v`, `granite3.2-vision`, `mistral-small3.1` | `gemma3:1b`/`270m` and the `llama3.2` default are text-only |
| Local Core | — | Always text-only |
| Custom | — | Always text-only (no catalog) |

The repository defaults `gpt-4o-mini`, `claude-sonnet-4-5`,
`gemini-3.8-flash` and OpenRouter's `openai/gpt-4o-mini` are vision-capable
out of the box. Groq's and Ollama's defaults are text-only — the composer
explains and offers the switch; it never switches for you.

Sources: [OpenAI images & vision guide](https://developers.openai.com/api/docs/guides/images-vision),
[Anthropic vision docs](https://docs.anthropic.com/en/docs/build-with-claude/vision),
[Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding),
[Groq vision docs](https://console.groq.com/docs/vision),
[Ollama vision docs](https://docs.ollama.com/capabilities/vision) and the
Ollama model library. Re-verify before extending the catalog.

## The image pipeline

1. **Intake (browser).** File picker, drag-and-drop onto the panel, or
   clipboard paste. Each file is read and validated end-to-end
   (`readImageFile`): declared type, byte length, strict base64, and
   magic-byte signature must all agree. Previews are session-only `blob:`
   URLs. Nothing is sent anywhere until the user submits.
2. **Composer gating.** With images pending, the composer shows where they
   will go (cloud provider + model, or local Ollama) — or blocks submission
   with the reason when the selected model cannot see images.
3. **Normalized payload.** Images ride the existing request as
   `images: [{ mimeType, data }]`, where `data` is raw base64 (never a data
   URL, never embedded in message text). Text history stays plain strings;
   text-only requests omit the field entirely.
4. **Server validation.** `POST /api/jarvis` re-validates everything before
   streaming (`validateImageAttachments`): PNG/JPEG/WebP only, at most 3
   images, 5 MiB each, 10 MiB total, strict base64, magic bytes must match
   the declared type. Failures are a plain 400. Client metadata is never
   trusted; only the first bytes are decoded for the signature check and
   sizes are computed exactly from the base64 length.
5. **Capability gate.** After the `meta` frame, the route looks the model up.
   A text-only model (or one over its recorded image cap) refuses the turn
   with an `unsupported_modality` error frame — no provider call, no silent
   switch to another provider/model, no Local Core fallback. The browser
   applies the same check twice more (composer + send path) so the failure
   is explained before anything leaves the machine.
6. **Serialization.** Each adapter splices images into the **last user
   message only**, in its native shape:
   - OpenAI-compatible (OpenAI, Groq, OpenRouter, Ollama): content parts
     `[{type:"text"}, {type:"image_url", image_url:{url:"data:…"}}]`.
     Ollama serves these through its OpenAI-compatible `/v1` endpoint; its
     compatibility layer accepts the standard object form (verified against
     the Ollama source), so no Ollama special-casing exists.
   - Anthropic: `[{type:"text"}, {type:"image", source:{type:"base64", …}}]`
     blocks.
   - Gemini: `[{text}, {inline_data:{mime_type, data}}]` parts.

   With no images, every adapter emits exactly the payloads it always did.

## Privacy invariants

Image bytes and data URLs **never** enter:

- browser persistence (`localStorage`) — the conversation store writes
  explicit text fields only; preview URLs are stripped by construction
- the saved-memory pinboard
- SQLite memory, conversation persistence, or reflection/learning inputs —
  `ChatTurn` history is text-only and images are forwarded to exactly one
  place, the current turn's provider call
- telemetry, analytics, logs, diagnostics, error messages or provider
  metadata — errors contain static text and model names only

There is no third-party file hosting: images go directly from this server to
the user-selected provider in the same request shape as text. An image
leaves the machine only on deliberate submission to a configured cloud
provider, with the destination named in the UI beforehand. Memory v2's
boundaries are unchanged (see `docs/MEMORY.md`).

## Known limitations

- **Follow-up turns can't see earlier images.** History is text-only by
  design, so after an image turn the model remembers the conversation, not
  the pixels. Re-attach the image to ask more about it. (Preview thumbnails
  remain visible in the current session only.)
- **Custom endpoints are text-only**, even if the hosted model could accept
  images — capability claims come from the verified catalog, not hope.
- **Catalog drift.** Provider lineups change; a newly released vision model
  is text-only to JARVIS until it is verified and added to
  `lib/ai/model-capabilities.ts`.
- Formats are PNG, JPEG and WebP; size and count limits above are enforced
  on both client and server.
- Audio, video and image generation are not implemented. The capability
  fields exist so those features can be added without reshaping the
  registry.

## Testing notes

Automated tests mock the network (no live keys): capability lookup table,
attachment validation, per-adapter serialization, route gating (refusals make
zero provider calls), persistence/reflection exclusion, and composer UI
rendering. A manual smoke test was run against a fake local Ollama endpoint
(October 2026): a `qwen3-vl` image turn streamed a reply with the image
serialized as a data URL, a `llama3.2` image turn was refused with
`unsupported_modality`, and the SQLite store contained no image data. No live
cloud provider was called during development.
