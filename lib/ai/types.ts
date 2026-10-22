import type { AiProviderId } from "./providers";
import type { SearchNotice } from "./search/types";
import type {
  ImageAttachmentPayload,
  ImageMimeType,
} from "./attachments";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  /** Provider label reported by the API for this reply. */
  provider?: string;
  /** True for local system notes such as "Opened DJ module". */
  action?: boolean;
  error?: boolean;
  streaming?: boolean;
  /**
   * Local-only message: composed in this browser from the memory stores and
   * never allowed to leave it. Explicit recall of SQLite-derived facts and
   * skills sets this, so the answer can be read on screen but is excluded
   * from model requests (`buildOutgoingHistory`), browser conversation
   * storage (`saveConversation`) and therefore from SQLite conversation
   * backfill. Every boundary filters on the flag itself, not on a missing
   * field, so a hand-edited record or a stray spread cannot re-admit it.
   */
  localOnly?: boolean;
  /** Web search state for this turn, when one was attempted. */
  search?: SearchNotice;
  /**
   * Session-only `blob:` preview URLs for images the user attached to
   * this message. Ephemeral by design: never persisted (the
   * conversation store writes explicit fields only), never sent to the
   * server as history, and gone after a reload.
   */
  imagePreviews?: string[];
}

/** An image the user is about to send: wire payload + local preview. */
export interface OutgoingImage {
  mimeType: ImageMimeType;
  /** Base64-encoded bytes (no data-URL prefix). Current turn only. */
  data: string;
  /** `blob:` object URL for local preview. Never leaves the browser. */
  previewUrl: string;
}

export interface AssistantMeta {
  provider: AiProviderId;
  model: string;
  source: "server" | "none";
  fallback: boolean;
  /** False when the selected provider is missing server-side configuration. */
  configured?: boolean;
  reason?: string | null;
  code?: string;
}

export interface ServerStatus {
  status: string;
  version: string;
  local: boolean;
  providers: Record<string, boolean>;
  /** True when TAVILY_API_KEY is set on the server. Never the key itself. */
  webSearch?: boolean;
}

export interface JarvisRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  /**
   * Images attached to the current (last) user turn only. Ephemeral:
   * the server serializes them into this one provider request and never
   * persists, learns from or logs them. Omitted entirely for text turns.
   */
  images?: ImageAttachmentPayload[];
  memories: string[];
  ownerName: string;
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  context: {
    activeModule: string;
    openWindows: number;
  };
  /** Settings toggle. The server may still decline to search. */
  webSearch?: boolean;
  /**
   * Settings → Memory bank toggle. `false` means: inject no saved facts
   * (pinboard or server store) and do not learn from this turn.
   * Conversation persistence is unaffected.
   */
  memoryEnabled?: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  code?: string;
  provider?: string;
  model?: string;
}
