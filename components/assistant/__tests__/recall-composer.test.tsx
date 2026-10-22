// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * Composer behaviour while a local recall request is in flight.
 *
 * The assistant panel is rendered for real (its own submit guard, its own
 * input state) on top of the real provider, with only the transport mocked.
 * The regression: text typed during recall must stay in the composer, not be
 * cleared and then discarded because the provider is busy.
 */

const { streamJarvis, fetchRecall } = vi.hoisted(() => ({
  streamJarvis: vi.fn(),
  fetchRecall: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
  streamJarvis,
  fetchRecall,
  fetchServerStatus: vi.fn(async () => null),
}));

import { JarvisProvider } from "@/components/assistant/JarvisProvider";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import { useAppStore } from "@/lib/store";
import type { RecallResponse } from "@/lib/memory/recall";

const RECALL: RecallResponse = {
  enabled: true,
  limit: 25,
  facts: [{ key: "home_city", value: "Murcia" }],
  skills: [],
  totalFacts: 1,
  totalSkills: 0,
  withheld: { facts: 0, skills: 0 },
};

let container: HTMLDivElement;
let root: Root;

function input(): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(
    'input[aria-label="Message JARVIS"]'
  );
  if (!element) throw new Error("composer input not rendered");
  return element;
}

function log(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[role="log"]');
  if (!element) throw new Error("conversation log not rendered");
  return element;
}

/** Type into the controlled input the way a user does. */
async function type(text: string) {
  const element = input();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  await act(async () => {
    setter?.call(element, text);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Submit the composer form. */
async function submit() {
  const form = input().closest("form");
  if (!form) throw new Error("composer form not found");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

let hadOwnScrollTo = false;
let originalScrollTo: unknown;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no Element.scrollTo; the panel auto-scrolls the log. Install a
  // shim for this file only and remove it again afterwards so later test
  // files in the same worker see an untouched prototype.
  hadOwnScrollTo = Object.prototype.hasOwnProperty.call(
    Element.prototype,
    "scrollTo"
  );
  originalScrollTo = hadOwnScrollTo
    ? (Element.prototype as unknown as { scrollTo: unknown }).scrollTo
    : undefined;
  Object.defineProperty(Element.prototype, "scrollTo", {
    value: () => undefined,
    writable: true,
    configurable: true,
  });
});

afterAll(() => {
  if (hadOwnScrollTo) {
    Object.defineProperty(Element.prototype, "scrollTo", {
      value: originalScrollTo,
      writable: true,
      configurable: true,
    });
  } else {
    delete (Element.prototype as unknown as { scrollTo?: unknown }).scrollTo;
  }
});

beforeEach(async () => {
  streamJarvis.mockReset();
  fetchRecall.mockReset();
  localStorage.clear();

  useAppStore.setState((state) => ({
    booted: true,
    assistantOpen: true,
    settings: { ...state.settings, voiceEnabled: false, memoryEnabled: true },
  }));

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        JarvisProvider,
        null,
        createElement(AssistantPanel, null)
      )
    );
  });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

describe("composer during an in-flight recall", () => {
  it("keeps text typed during recall instead of clearing and dropping it", async () => {
    let resolveRecall!: (value: RecallResponse) => void;
    fetchRecall.mockImplementation(
      () =>
        new Promise<RecallResponse>((resolve) => {
          resolveRecall = resolve;
        })
    );

    await type("what do you remember?");
    await submit();

    // The recall request is in flight and the composer is in its busy state.
    expect(fetchRecall).toHaveBeenCalledTimes(1);
    const stopButton = document.querySelector('button[title="Stop generating"]');
    expect(stopButton).not.toBeNull();

    // The user types the next message while JARVIS is still recalling.
    await type("draft that must survive");
    expect(input().value).toBe("draft that must survive");

    // Submitting is refused by the existing guard — but nothing is cleared.
    await submit();
    expect(input().value).toBe("draft that must survive");
    expect(streamJarvis).not.toHaveBeenCalled();
    expect(log().textContent).not.toContain("draft that must survive");

    // When recall completes, the answer appears and the draft is still there.
    await act(async () => {
      resolveRecall(RECALL);
    });
    expect(log().textContent).toContain("home_city: Murcia");
    expect(input().value).toBe("draft that must survive");

    // ...and it can then be sent normally.
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onDelta?.("Sent after recall.");
      return null;
    });
    await submit();
    await act(async () => {
      await Promise.resolve();
    });
    expect(input().value).toBe("");
  });
});
