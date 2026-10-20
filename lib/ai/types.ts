import type { AiProviderId } from "./providers";
import type { SearchNotice } from "./search/types";

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
  /** Web search state for this turn, when one was attempted. */
  search?: SearchNotice;
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
