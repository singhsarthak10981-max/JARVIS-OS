import type { AiProviderId } from "./providers";

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
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  code?: string;
  provider?: string;
  model?: string;
}
