// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Regression tests for the voice launch request lifecycle.
 *
 * The original defect: `handledRequest.current` was assigned *before* the
 * `status.state === "checking"` early return, so a request that arrived while
 * the bridge probe was still running was marked handled and then dropped — the
 * effect never ran again for it.
 */

const bridge = vi.hoisted(() => ({
  status: {
    state: "checking" as string,
    health: null as unknown,
    detail: "Checking…",
  },
  run: vi.fn(),
}));

vi.mock("@/features/dj/hooks/useDjBridge", () => ({
  useDjBridge: () => ({
    status: bridge.status,
    busyAction: null,
    run: bridge.run,
    refresh: vi.fn(),
  }),
}));

import DjLaunchpad from "@/features/dj/components/DjLaunchpad";
import { useAppStore } from "@/lib/store";

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => {
    root.render(
      <DjLaunchpad
        meta={null}
        trackCount={0}
        onOpenLibrary={() => {}}
        onImport={() => {}}
      />
    );
  });
}

function setBridgeState(state: string) {
  bridge.status = { state, health: null, detail: `state: ${state}` };
  render();
}

beforeEach(() => {
  (
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  bridge.run.mockReset();
  bridge.run.mockResolvedValue({ ok: true, message: "requested" });
  bridge.status = { state: "checking", health: null, detail: "Checking…" };

  // Reset the launch lifecycle for each test.
  useAppStore.setState({ djLaunchRequest: 0, djLaunchConsumed: 0 });
  useAppStore.getState().clearActivity();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("voice launch request lifecycle", () => {
  it("does not consume a request that arrives while the probe is checking", () => {
    render();

    act(() => {
      useAppStore.getState().requestDjLaunch();
    });

    const state = useAppStore.getState();
    expect(state.djLaunchRequest).toBe(1);
    // Still pending: nothing has been acted on yet.
    expect(state.djLaunchConsumed).toBe(0);
    expect(bridge.run).not.toHaveBeenCalled();
  });

  it("honours a pending request once the probe settles offline", () => {
    render();

    act(() => {
      useAppStore.getState().requestDjLaunch();
    });
    expect(useAppStore.getState().djLaunchConsumed).toBe(0);

    setBridgeState("offline");

    // The request is now consumed and the user is told nothing launched.
    expect(useAppStore.getState().djLaunchConsumed).toBe(1);
    expect(container.textContent).toContain("not connected");
    expect(bridge.run).not.toHaveBeenCalled();
  });

  it("launches exactly once when the probe settles online", async () => {
    render();

    act(() => {
      useAppStore.getState().requestDjLaunch();
    });
    expect(bridge.run).not.toHaveBeenCalled();

    await act(async () => {
      setBridgeState("online");
    });

    expect(bridge.run).toHaveBeenCalledTimes(1);
    expect(bridge.run).toHaveBeenCalledWith("rekordbox.launch");
    expect(useAppStore.getState().djLaunchConsumed).toBe(1);
  });

  it("never replays an already-consumed request", async () => {
    render();

    await act(async () => {
      setBridgeState("online");
    });

    act(() => {
      useAppStore.getState().requestDjLaunch();
    });
    await act(async () => {
      useAppStore.getState().consumeDjLaunch(1);
    });

    // Re-render twice; the consumed request must not fire again.
    render();
    render();

    expect(bridge.run).toHaveBeenCalledTimes(1);
  });

  it("handles a request made while the launchpad was unmounted", async () => {
    act(() => root.unmount());
    root = createRoot(container);

    // Request arrives with no launchpad mounted, then the probe settles.
    act(() => {
      useAppStore.getState().requestDjLaunch();
    });
    bridge.status = { state: "online", health: null, detail: "online" };
    useAppStore.setState({ djLaunchRequest: 1, djLaunchConsumed: 0 });

    await act(async () => {
      render();
    });

    expect(bridge.run).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().djLaunchConsumed).toBe(1);
  });
});
