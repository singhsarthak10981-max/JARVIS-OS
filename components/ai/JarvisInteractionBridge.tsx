"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

const INPUT_SELECTOR = 'input[aria-label="Ask J.A.R.V.I.S. anything"]';

interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JarvisResponseEventDetail {
  response: string;
  query: string;
  error?: boolean;
}

function dispatchResponse(detail: JarvisResponseEventDetail) {
  window.dispatchEvent(
    new CustomEvent<JarvisResponseEventDetail>("jarvis:response", { detail }),
  );
}

export default function JarvisInteractionBridge() {
  const requestId = useRef(0);
  const history = useRef<JarvisMessage[]>([]);

  useEffect(() => {
    let processing = false;

    const handleFocus = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target?.matches(INPUT_SELECTOR) || processing) return;

      const state = useAppStore.getState().aiState;
      if (state === "offline" || state === "error") return;
      useAppStore.getState().setAiState("listening");
    };

    const handleBlur = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target?.matches(INPUT_SELECTOR) || processing) return;

      if (useAppStore.getState().aiState === "listening") {
        useAppStore.getState().setAiState("idle");
      }
    };

    const handleSubmit = async (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;

      const input = form.querySelector<HTMLInputElement>(INPUT_SELECTOR);
      if (!input || processing) return;

      const query = input.value.trim();
      if (!query) return;

      processing = true;
      const id = ++requestId.current;
      const store = useAppStore.getState();

      if (store.aiState === "offline") {
        processing = false;
        return;
      }

      store.setAiState("thinking");

      try {
        const response = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            history: history.current,
            activeModule: store.activeModule,
            activeWorkspaceId: store.activeWorkspaceId,
          }),
        });

        const data = (await response.json()) as {
          response?: string;
          intent?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            data.error || "J.A.R.V.I.S. could not process the request.",
          );
        }

        if (id !== requestId.current) return;

        const assistantResponse =
          data.response?.trim() ||
          "I processed the request, but no response was returned.";

        history.current = [
          ...history.current,
          { role: "user", content: query },
          { role: "assistant", content: assistantResponse },
        ].slice(-12);

        dispatchResponse({
          response: assistantResponse,
          query,
        });

        store.setAiState("speaking");
        window.setTimeout(() => {
          if (id === requestId.current) {
            processing = false;
            useAppStore.getState().setAiState("idle");
          }
        }, 2200);
      } catch (error) {
        if (id !== requestId.current) return;

        const message =
          error instanceof Error
            ? error.message
            : "Unable to reach the J.A.R.V.I.S. AI service.";

        dispatchResponse({ response: message, query, error: true });
        store.setAiState("error");

        window.setTimeout(() => {
          if (id === requestId.current) {
            processing = false;
            useAppStore.getState().setAiState("idle");
          }
        }, 1800);
      }
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      document.removeEventListener("submit", handleSubmit, true);
      processing = false;
    };
  }, []);

  return null;
}
