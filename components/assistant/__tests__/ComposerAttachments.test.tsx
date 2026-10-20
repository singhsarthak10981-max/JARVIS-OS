import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AttachImageControl,
  PendingImageStrip,
  type PendingImage,
} from "@/components/assistant/ComposerAttachments";

/**
 * Static render tests for the image-attachment composer UI: the attach
 * control offers only supported formats, pending images render
 * removable previews, and the strip announces blocked/error states.
 * Attachment bytes must never appear in the rendered markup — previews
 * are blob URLs only.
 */

const images: PendingImage[] = [
  {
    id: "pending-1",
    mimeType: "image/png",
    data: "QUJDREVG",
    byteSize: 6,
    previewUrl: "blob:preview-one",
  },
  {
    id: "pending-2",
    mimeType: "image/jpeg",
    data: "R0hJSkts",
    byteSize: 6,
    previewUrl: "blob:preview-two",
  },
];

describe("AttachImageControl", () => {
  it("offers a labelled file input limited to supported image types", () => {
    const html = renderToStaticMarkup(
      createElement(AttachImageControl, {
        onFiles: vi.fn(),
        hasPending: false,
      })
    );

    expect(html).toContain('data-testid="image-attach-input"');
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).toContain("multiple");
    expect(html).toContain('aria-label="Attach an image"');
  });
});

describe("PendingImageStrip", () => {
  it("renders nothing when there is nothing to show", () => {
    const html = renderToStaticMarkup(
      createElement(PendingImageStrip, {
        images: [],
        onRemove: vi.fn(),
        status: null,
      })
    );
    expect(html).toBe("");
  });

  it("previews every pending image with labelled remove controls", () => {
    const html = renderToStaticMarkup(
      createElement(PendingImageStrip, {
        images,
        onRemove: vi.fn(),
        status: {
          kind: "destination" as const,
          message:
            "Cloud processing: the image will be sent to OpenAI when you submit.",
        },
      })
    );

    expect(html).toContain('data-testid="pending-images"');
    expect(html).toContain('src="blob:preview-one"');
    expect(html).toContain('src="blob:preview-two"');
    expect(html).toContain('alt="Attached image 1"');
    expect(html).toContain('aria-label="Remove image 1"');
    expect(html).toContain('aria-label="Remove image 2"');
    expect(html).toContain('data-status="destination"');
    expect(html).toContain("Cloud processing: the image will be sent to OpenAI");
  });

  it("never renders attachment bytes", () => {
    const html = renderToStaticMarkup(
      createElement(PendingImageStrip, {
        images,
        onRemove: vi.fn(),
        status: null,
      })
    );
    expect(html).not.toContain("QUJDREVG");
    expect(html).not.toContain("R0hJSkts");
    expect(html).not.toContain("base64");
  });

  it("announces the blocked state for text-only models", () => {
    const html = renderToStaticMarkup(
      createElement(PendingImageStrip, {
        images,
        onRemove: vi.fn(),
        status: {
          kind: "blocked" as const,
          message: "This model has no image input. Remove the image.",
        },
      })
    );
    expect(html).toContain('data-status="blocked"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("has no image input");
  });

  it("shows validation errors even when no image was accepted", () => {
    const html = renderToStaticMarkup(
      createElement(PendingImageStrip, {
        images: [],
        onRemove: vi.fn(),
        status: {
          kind: "error" as const,
          message: "Only PNG, JPEG and WebP images are supported.",
        },
      })
    );
    expect(html).toContain('data-status="error"');
    expect(html).toContain("Only PNG, JPEG and WebP");
  });
});
