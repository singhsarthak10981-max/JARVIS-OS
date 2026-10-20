# v1.5.0 — Multimodal Foundation (image input)

Text-only progress entry: no screenshots were captured for this release, and
none are fabricated. See `docs/MULTIMODAL.md` for the full architecture.

## What shipped

- A typed model-capability registry (`lib/ai/model-capabilities.ts`):
  text in/out, image input, and designed-but-unimplemented fields for audio
  in/out, video input and image generation. Unknown models, Custom endpoints
  and Local Core are text-only; capability is kept strictly separate from
  availability and credentials.
- An image-input pipeline end to end: composer attach (picker, drag-and-drop,
  clipboard paste, previews, remove), client + server validation (PNG/JPEG/
  WebP, ≤3 images, 5 MiB each, 10 MiB total, strict base64, magic-byte type
  checks), per-adapter serialization (OpenAI-compatible `image_url`,
  Anthropic base64 blocks, Gemini `inline_data`), and an
  `unsupported_modality` refusal — with no provider call and no silent
  fallback — when the selected model cannot see images.
- Privacy is structural: image bytes never enter browser persistence, the
  memory pinboard, SQLite, reflection learning, telemetry, logs, diagnostics
  or error messages. The composer names the destination (cloud vs local
  Ollama) before submission.

## Verification (October 2026)

- `npm run verify` (ESLint + TypeScript + Vitest): exit 0 — 831 tests across
  59 files, including 79 new tests for capabilities, attachment validation,
  serialization, route gating, persistence exclusion and composer rendering.
- `npm run build` (`next build`): exit 0.
- Manual smoke against a fake local Ollama endpoint (production server):
  a `qwen3-vl:8b` image turn streamed a reply and the endpoint received the
  image as an `image_url` data URL; a `llama3.2` image turn was refused with
  `unsupported_modality` and made no provider call; malformed payloads got a
  400; a text-only turn streamed normally; the SQLite store afterwards
  contained no image data.
- No live cloud provider was called; all automated tests mock the network.

## Known limitations

- Follow-up turns cannot see earlier images — history stays text-only by
  design; re-attach to ask more.
- Custom endpoints are text-only (no verified catalog).
- Audio transcription, real-time voice, video and image generation are not
  implemented and are not advertised as working.
