import { describe, expect, it } from "vitest";
import {
  CAPABILITY_IDS,
  capabilityExists,
  capabilityForAction,
  getCapability,
  implementedCapabilities,
  listCapabilities,
} from "../registry";
import { isCapabilityId } from "../ids";
import { capabilityResult } from "../types";
import type { JarvisAction } from "@/lib/ai/intents";

/**
 * The registry is only useful if it is honest. These tests pin the honesty
 * rules: every routed action maps to an implemented capability, nothing
 * planned is advertised as usable, and metadata that promises a confirmation
 * cannot contradict the executor.
 */

const ALL_ACTION_TYPES: JarvisAction["type"][] = [
  "open-module",
  "close-module",
  "close-all-windows",
  "set-theme",
  "set-wallpaper",
  "toggle-setting",
  "start-timer",
  "cancel-timers",
  "remember",
  "forget-memory",
  "reboot",
  "clear-session",
  "open-palette",
  "export-logs",
  "stop-speaking",
  "set-dj-view",
];

describe("capability ids", () => {
  it("are unique and match the descriptors exactly", () => {
    expect(new Set(CAPABILITY_IDS).size).toBe(CAPABILITY_IDS.length);
    expect(listCapabilities().map((capability) => capability.id).sort()).toEqual(
      [...CAPABILITY_IDS].sort()
    );
  });

  it("rejects unknown ids and lookalikes", () => {
    expect(isCapabilityId("window-control")).toBe(true);
    expect(isCapabilityId("window-control ")).toBe(false);
    expect(isCapabilityId("shell")).toBe(false);
    expect(isCapabilityId("")).toBe(false);
    expect(isCapabilityId(null)).toBe(false);
    expect(capabilityExists("made-up-capability")).toBe(false);
    expect(getCapability("window-control")?.name).toBe(
      "Window & module control"
    );
  });

  it("contains no arbitrary-execution capability", () => {
    for (const id of CAPABILITY_IDS) {
      expect(id).not.toMatch(/shell|exec|eval|arbitrary|script/);
    }
  });
});

describe("action coverage", () => {
  it("maps every routed action to exactly one implemented capability", () => {
    for (const type of ALL_ACTION_TYPES) {
      const matches = listCapabilities().filter((capability) =>
        capability.actionTypes.includes(type)
      );
      expect(matches, `action type ${type}`).toHaveLength(1);
      expect(matches[0].availability, `action type ${type}`).toBe(
        "implemented"
      );
    }
  });

  it("returns null for an unregistered action instead of guessing", () => {
    const unknown = { type: "definitely-not-an-action" } as unknown as JarvisAction;
    expect(capabilityForAction(unknown)).toBeNull();
  });

  it("describes the real window and appearance routing", () => {
    expect(
      capabilityForAction({ type: "open-module", moduleId: "dj" })?.id
    ).toBe("window-control");
    expect(capabilityForAction({ type: "set-theme", theme: "next" })?.id).toBe(
      "appearance"
    );
    expect(
      capabilityForAction({ type: "start-timer", seconds: 60, label: "tea" })
        ?.id
    ).toBe("timers");
    expect(capabilityForAction({ type: "remember", fact: "x" })?.id).toBe(
      "memory-write"
    );
    expect(capabilityForAction({ type: "forget-memory" })?.id).toBe(
      "memory-clear"
    );
  });
});

describe("availability honesty", () => {
  it("keeps planned capabilities unavailable", () => {
    for (const id of ["email", "calendar", "weather", "smart-home"] as const) {
      const capability = getCapability(id)!;
      expect(capability.availability).toBe("planned");
      expect(capability.operations).toHaveLength(0);
      expect(capability.actionTypes).toHaveLength(0);
    }
  });

  it("registers the implemented local-file scope honestly", () => {
    const files = getCapability("local-file-browsing")!;
    expect(files.availability).toBe("implemented");
    expect(files.mutatesState).toBe(false);
    expect(files.destructive).toBe(false);
    expect(files.requiresConfirmation).toBe(false);
    expect(files.operations).toEqual([
      "Select one supported local text file",
      "Preview up to 12,000 characters",
    ]);
    expect(files.actionTypes).toHaveLength(0);
    expect(files.note).toMatch(/no directory scanning/i);
    expect(files.note).toMatch(/automatic AI upload/i);
  });

  it("keeps the bridge-backed capabilities unavailable", () => {
    const launch = getCapability("rekordbox-launch")!;
    expect(launch.availability).toBe("unavailable");
    expect(launch.summary).toMatch(/no bridge ships|would ask/i);
    expect(launch.note).toMatch(/never claims a launch/i);

    const hardware = getCapability("dj-hardware-control")!;
    expect(hardware.availability).toBe("unavailable");
    expect(hardware.note).toMatch(/inert/i);
  });

  it("only routes actions through implemented capabilities", () => {
    for (const capability of listCapabilities()) {
      if (capability.actionTypes.length > 0) {
        expect(capability.availability).toBe("implemented");
      }
    }
    expect(implementedCapabilities().length).toBeGreaterThan(0);
  });

  it("flags state-changing and destructive capabilities consistently", () => {
    for (const capability of listCapabilities()) {
      expect(typeof capability.requiresConfirmation).toBe("boolean");
      if (capability.destructive) {
        expect(capability.mutatesState).toBe(true);
      }
      if (capability.availability === "planned") {
        // Nothing planned is executable, so the flag is purely permissive.
        expect(capability.availability).not.toBe("implemented");
      }
    }

    expect(getCapability("window-control")?.mutatesState).toBe(true);
    expect(getCapability("window-control")?.requiresConfirmation).toBe(false);
    expect(getCapability("memory-clear")?.destructive).toBe(true);
    expect(getCapability("system-control")?.destructive).toBe(true);
    expect(getCapability("ai-conversation")?.mutatesState).toBe(false);
    expect(getCapability("web-search")?.mutatesState).toBe(false);
  });

  it("documents the setup requirement for web search", () => {
    expect(getCapability("web-search")?.note).toMatch(/TAVILY_API_KEY/);
  });
});

describe("result contract", () => {
  it("reports an unsupported action without inventing an id", () => {
    const result = capabilityResult(null, "unsupported", "No such capability.");
    expect(result).toEqual({
      capabilityId: null,
      status: "unsupported",
      ok: false,
      message: "No such capability.",
    });
  });

  it("mirrors ok from status and keeps the capability id", () => {
    const success = capabilityResult("timers", "success", "Timer armed.");
    expect(success).toMatchObject({
      capabilityId: "timers",
      status: "success",
      ok: true,
    });

    for (const status of ["failed", "denied", "cancelled", "unsupported"] as const) {
      const result = capabilityResult("timers", status, "no");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(status);
    }
  });
});
