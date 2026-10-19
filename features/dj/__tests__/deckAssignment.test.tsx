// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Regression tests for deck assignment logging.
 *
 * The original defect: the activity entry used `(slot ?? 0) + 1`, so every
 * automatic assignment claimed "Deck 1" even when the track landed on deck 2,
 * 3 or 4. The log and the state write now share one resolved target.
 */

vi.mock("@/features/dj/hooks/useDjBridge", () => ({
  useDjBridge: () => ({
    status: { state: "offline", health: null, detail: "offline" },
    busyAction: null,
    run: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// The right rail needs the assistant context; the deck logic under test does
// not, so the panels are stubbed out.
vi.mock("@/features/dj/components/performance/VoiceActivationPanel", () => ({
  default: () => <div data-testid="voice-panel" />,
}));
vi.mock("@/features/dj/components/performance/SpotifyPanel", () => ({
  default: () => <div data-testid="spotify-panel" />,
}));
vi.mock("@/features/dj/components/performance/SessionLog", () => ({
  default: () => <div data-testid="session-log" />,
}));

import PerformanceModule from "@/features/dj/components/performance/PerformanceModule";
import { useAppStore } from "@/lib/store";
import type { DjTrack } from "@/features/dj/types";

const tracks: DjTrack[] = [
  { id: "t1", title: "Midnight Drive", artist: "Kessler", bpm: 128, camelot: "8A", durationSec: 372 },
  { id: "t2", title: "Low End Theory", artist: "Ren", bpm: 132, camelot: "12B", durationSec: 290 },
  { id: "t3", title: "Glass Horizon", artist: "Ava Lune", bpm: 124, camelot: "7A", durationSec: 428 },
  { id: "t4", title: "Night Bus", artist: "Sable", bpm: 126, camelot: "9B", durationSec: 341 },
];

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => {
    root.render(
      <PerformanceModule
        tracks={tracks}
        meta={null}
        libraryLoaded
        onOpenLaunchpad={() => {}}
        onOpenLibrary={() => {}}
        onImport={() => {}}
      />
    );
  });
}

/** Adds a specific track from the collection strip to the decks. */
function addTrack(title: string) {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Add ${title} to set"]`
  );
  if (!button) throw new Error(`No add button for "${title}"`);
  act(() => {
    button.click();
  });
}

function deckTitles(): string[] {
  return [1, 2, 3, 4].map((n) => {
    const section = container.querySelector(`section[aria-label="Deck ${n}"]`);
    return section?.textContent ?? "";
  });
}

function loggedAssignments(): string[] {
  return useAppStore
    .getState()
    .activity.filter((entry) => entry.event.includes("←"))
    .map((entry) => entry.event);
}

beforeEach(() => {
  (
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  window.localStorage.clear();
  useAppStore.getState().clearActivity();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

describe("deck assignment activity log", () => {
  it("logs the first deck when the first deck is filled", () => {
    render();
    addTrack("Midnight Drive");

    expect(deckTitles()[0]).toContain("Midnight Drive");
    expect(loggedAssignments()[0]).toBe("Deck 1 ← Midnight Drive");
  });

  it("logs Deck 2 when the second deck is filled, not Deck 1", () => {
    render();
    addTrack("Midnight Drive"); // deck 1
    addTrack("Low End Theory"); // deck 2

    expect(deckTitles()[1]).toContain("Low End Theory");
    // Most recent entry first.
    expect(loggedAssignments()[0]).toBe("Deck 2 ← Low End Theory");
  });

  it("keeps the log aligned with the deck for all four slots", () => {
    render();
    addTrack("Midnight Drive");
    addTrack("Low End Theory");
    addTrack("Glass Horizon");
    addTrack("Night Bus");

    expect(loggedAssignments().slice(0, 4)).toEqual([
      "Deck 4 ← Night Bus",
      "Deck 3 ← Glass Horizon",
      "Deck 2 ← Low End Theory",
      "Deck 1 ← Midnight Drive",
    ]);

    const titles = deckTitles();
    expect(titles[0]).toContain("Midnight Drive");
    expect(titles[1]).toContain("Low End Theory");
    expect(titles[2]).toContain("Glass Horizon");
    expect(titles[3]).toContain("Night Bus");
  });

  it("persists the assignments it logged", () => {
    render();
    addTrack("Midnight Drive");
    addTrack("Low End Theory");

    const raw = window.localStorage.getItem("jarvis-dj-decks-v1");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw as string) as { slots: (string | null)[] };
    expect(stored.slots[0]).toBe("t1");
    expect(stored.slots[1]).toBe("t2");
  });
});
