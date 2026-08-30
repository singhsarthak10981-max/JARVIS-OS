"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

const INPUT_SELECTOR = 'input[aria-label="Ask J.A.R.V.I.S. anything"]';

function containsWorkspaceCommand(value: string): boolean {
  const query = value.toLowerCase();
  return ["producer", "dj", "business", "bar"].some((name) =>
    query.includes(name),
  );
}

export default function JarvisInteractionBridge() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current = [];
    };

    let input: HTMLInputElement | null = null;
    let form: HTMLFormElement | null = null;
    let processing = false;

    const bind = () => {
      input = document.querySelector<HTMLInputElement>(INPUT_SELECTOR);
      form = input?.closest("form") ?? null;
      if (!input || !form) return false;

      const handleFocus = () => {
        if (processing) return;
        const state = useAppStore.getState().aiState;
        if (state === "offline" || state === "error") return;
        useAppStore.getState().setAiState("listening");
      };

      const handleBlur = () => {
        if (processing) return;
        if (useAppStore.getState().aiState === "listening") {
          useAppStore.getState().setAiState("idle");
        }
      };

      const handleSubmit = (event: Event) => {
        const currentInput = input;
        const currentForm = form;
        if (!currentInput || !currentForm) return;

        const trimmed = currentInput.value.trim();
        if (!trimmed) return;

        event.stopPropagation();
        clearTimers();
        processing = true;

        const store = useAppStore.getState();
        if (store.aiState === "offline") {
          processing = false;
          return;
        }

        store.setAiState("thinking");

        const workspaceCommand = containsWorkspaceCommand(trimmed);

        if (workspaceCommand) {
          timers.current.push(
            setTimeout(() => {
              useAppStore.getState().setAiState("executing");
            }, 850),
          );

          timers.current.push(
            setTimeout(() => {
              useAppStore.getState().setAiState("speaking");
            }, 1650),
          );

          timers.current.push(
            setTimeout(() => {
              processing = false;
              useAppStore.getState().setAiState("idle");
            }, 3200),
          );
        } else {
          timers.current.push(
            setTimeout(() => {
              useAppStore.getState().setAiState("speaking");
            }, 1050),
          );

          timers.current.push(
            setTimeout(() => {
              processing = false;
              useAppStore.getState().setAiState("idle");
            }, 2950),
          );
        }
      };

      input.addEventListener("focus", handleFocus);
      input.addEventListener("blur", handleBlur);
      form.addEventListener("submit", handleSubmit, true);

      return () => {
        input?.removeEventListener("focus", handleFocus);
        input?.removeEventListener("blur", handleBlur);
        form?.removeEventListener("submit", handleSubmit, true);
      };
    };

    let cleanup: (() => void) | undefined;
    const retryTimer = setTimeout(() => {
      cleanup = bind() || undefined;
    }, 0);

    return () => {
      clearTimeout(retryTimer);
      cleanup?.();
      clearTimers();
    };
  }, []);

  return null;
}
