// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ModulePreview from "../ModulePreview";
import { MODULES, MODULE_SECTIONS, getModulesBySection } from "@/lib/modules";

/**
 * The placeholder shell previously announced "Module mounted successfully"
 * and "STATUS: ONLINE", which described the component tree and looked like a
 * working integration. These assertions keep the copy honest.
 */
describe("ModulePreview", () => {
  it("states plainly that the workspace is not built", () => {
    const html = renderToStaticMarkup(<ModulePreview moduleId="producer" />);

    expect(html).toContain("Not yet built");
    expect(html).toContain("This is a shell");
  });

  it("does not claim a live integration or fake success", () => {
    for (const moduleId of ["producer", "bar", "business"] as const) {
      const html = renderToStaticMarkup(<ModulePreview moduleId={moduleId} />);
      expect(html).not.toContain("Module mounted successfully");
      expect(html).not.toMatch(/STATUS[^<]*ONLINE/);
      expect(html).not.toContain("connected");
    }
  });

  it("lists only the workspace's own planned items", () => {
    const producer = renderToStaticMarkup(<ModulePreview moduleId="producer" />);
    expect(producer).toContain("Beat and session workspace");

    const bar = renderToStaticMarkup(<ModulePreview moduleId="bar" />);
    expect(bar).toContain("Stock and supplier records");
    expect(bar).not.toContain("Beat and session workspace");
  });

  it("offers one real action instead of inert controls", () => {
    const html = renderToStaticMarkup(<ModulePreview moduleId="business" />);
    expect(html).toContain("Ask JARVIS about this workspace");
    expect(html.match(/<button/g)).toHaveLength(1);
  });
});

describe("module registry sections", () => {
  it("gives every module a section that is rendered in the sidebar", () => {
    const sectionIds = MODULE_SECTIONS.map((section) => section.id);
    for (const mod of MODULES) {
      expect(sectionIds).toContain(mod.section);
    }
  });

  it("keeps the five pillars discoverable", () => {
    const total = MODULE_SECTIONS.reduce(
      (count, section) => count + getModulesBySection(section.id).length,
      0
    );
    expect(total).toBe(MODULES.length);
    expect(getModulesBySection("venue").map((m) => m.id)).toEqual(["bar"]);
  });

  it("labels the DJ workspace as Rekordbox, not Traktor", () => {
    const dj = MODULES.find((mod) => mod.id === "dj");
    expect(dj?.description).toContain("Rekordbox");
    expect(dj?.description).not.toContain("Traktor");
  });
});
