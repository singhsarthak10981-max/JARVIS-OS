import { JARVIS_CAPABILITIES } from "./intents";

/**
 * The zero-key language core. It cannot reason like a frontier model, but it
 * is honest, useful, and keeps JARVIS fully operational offline.
 */
export function buildLocalReply(
  userMessage: string,
  ownerName: string,
  memoryCount: number
): string {
  const text = userMessage.toLowerCase().trim();
  const owner = ownerName || "sir";

  if (/(api key|connect|provider|model|openai|anthropic|gemini|groq|ollama|setup|set up)/.test(text)) {
    return [
      `To bring my full reasoning online, ${owner}, open Settings → Intelligence.`,
      "Pick a provider, paste an API key and press Test Connection. OpenAI, Anthropic, Google Gemini, Groq, OpenRouter and any OpenAI-compatible endpoint are supported.",
      "If you'd rather keep everything local, run Ollama and point me at it — no key required.",
    ].join(" ");
  }

  if (/(jarvis os|this app|this system|what is jarvis)/.test(text)) {
    return [
      "JARVIS OS is your personal AI operating environment: a tactical desktop with modules for DJ, production, bar and business work.",
      "I sit above it as the control layer — modules, windows, themes, timers, memory and voice are all wired to me.",
      "The visual shell is complete; the language layer is the part that grows when you connect a model.",
    ].join(" ");
  }

  if (/(weather|news|email|calendar|stock|price|search the web|internet)/.test(text)) {
    return `I don't have that feed connected yet, ${owner}. Right now I run your desktop and answer from local context. Connecting a model or a small tool integration in the API layer would let me handle that properly.`;
  }

  if (/(who|what|why|how|when|where|which|can you|could you|do you|is there|are there)\b/.test(text) || text.endsWith("?")) {
    return [
      "I'm running on the local core, so I can't reason about that without a language model.",
      `My system control is fully online, though — ${JARVIS_CAPABILITIES[0].toLowerCase()}, timers, themes and memory${memoryCount > 0 ? ` (${memoryCount} memories loaded)` : ""}.`,
      "Add a provider key in Settings → Intelligence, or run a local Ollama model, and I'll answer open-ended questions properly.",
    ].join(" ");
  }

  if (text.length < 40) {
    return `Acknowledged, ${owner}. Give me a command — “open the Producer module”, “set a timer for 5 minutes”, “system status” — or connect a model for open conversation.`;
  }

  return [
    `Understood, ${owner}. I've noted it, but my local core can't hold a full conversation without a language model.`,
    "Try a desktop command, or wire up a provider in Settings → Intelligence.",
  ].join(" ");
}
