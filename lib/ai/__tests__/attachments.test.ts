// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  accumulateImages,
  imageDataUrl,
  IMAGE_LIMITS,
  readImageFile,
  validateImageAttachments,
  type ImageAttachmentPayload,
  type SizedImageAttachment,
} from "@/lib/ai/attachments";

/** 1×1 PNG — the fixture used in Anthropic's own API documentation. */
const PNG_DATA =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

function base64Of(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

const JPEG_DATA = base64Of([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array<number>(32).fill(0),
]);
const WEBP_DATA = base64Of([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ...Array<number>(16).fill(0),
]);

function png(): ImageAttachmentPayload {
  return { mimeType: "image/png", data: PNG_DATA };
}

function sized(byteSize: number): SizedImageAttachment {
  return { mimeType: "image/png", data: "ignored", byteSize };
}

describe("validateImageAttachments", () => {
  it("treats a missing field and an empty list as no attachments", () => {
    expect(validateImageAttachments(undefined)).toEqual({
      ok: true,
      images: [],
    });
    expect(validateImageAttachments([])).toEqual({ ok: true, images: [] });
  });

  it("accepts PNG, JPEG and WebP and reports exact decoded sizes", () => {
    const result = validateImageAttachments([
      png(),
      { mimeType: "image/jpeg", data: JPEG_DATA },
      { mimeType: "image/webp", data: WEBP_DATA },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.images.map((image) => image.mimeType)).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);
    expect(result.images[0].byteSize).toBe(atob(PNG_DATA).length);
  });

  it("rejects non-list payloads and malformed items", () => {
    const notList = validateImageAttachments("nope");
    expect(notList.ok).toBe(false);
    if (!notList.ok) expect(notList.error).toContain("list");

    const nullList = validateImageAttachments(null);
    expect(nullList.ok).toBe(false);

    for (const bad of [
      [null],
      ["text"],
      [{ mimeType: "image/png" }],
      [{ mimeType: "image/png", data: 42 }],
      [{ mimeType: "image/png", data: "" }],
    ]) {
      const result = validateImageAttachments(bad);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toContain("must include its type and data");
    }

    const noType = validateImageAttachments([{ data: PNG_DATA }]);
    expect(noType.ok).toBe(false);
    if (!noType.ok) expect(noType.error).toContain("Only PNG");
  });

  it("rejects unsupported media types", () => {
    const result = validateImageAttachments([
      { mimeType: "image/gif", data: PNG_DATA },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toContain("Only PNG, JPEG and WebP");
  });

  it("rejects malformed base64 and data-URL-prefixed payloads", () => {
    for (const data of [
      "!!!not-base64!!!",
      `data:image/png;base64,${PNG_DATA}`,
      "AAAA AAAA",
    ]) {
      const result = validateImageAttachments([
        { mimeType: "image/png", data },
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("invalid encoding");
    }
  });

  it("rejects bytes that do not match the declared type", () => {
    const mismatched = validateImageAttachments([
      { mimeType: "image/jpeg", data: PNG_DATA },
    ]);
    expect(mismatched.ok).toBe(false);
    if (!mismatched.ok)
      expect(mismatched.error).toContain("does not match");

    const text = base64Of(
      Array.from("this is definitely not an image payload at all").map((c) =>
        c.charCodeAt(0)
      )
    );
    const fake = validateImageAttachments([
      { mimeType: "image/png", data: text },
    ]);
    expect(fake.ok).toBe(false);
  });

  it("enforces the per-turn image count", () => {
    const result = validateImageAttachments([png(), png(), png(), png()]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("at most 3");
  });

  it("enforces per-image and total payload size limits", () => {
    const perImage = validateImageAttachments([png()], {
      maxImages: 3,
      maxImageBytes: 16,
      maxTotalBytes: 10_000,
    });
    expect(perImage.ok).toBe(false);
    if (!perImage.ok) expect(perImage.error).toContain("or smaller");

    const total = validateImageAttachments([png(), png()], {
      maxImages: 3,
      maxImageBytes: 10_000,
      maxTotalBytes: 100,
    });
    expect(total.ok).toBe(false);
    if (!total.ok) expect(total.error).toContain("must total");
  });

  it("never echoes attachment bytes in error messages", () => {
    const result = validateImageAttachments([
      { mimeType: "image/jpeg", data: PNG_DATA },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain(PNG_DATA.slice(0, 16));
  });

  it("keeps the shipped limits at the product defaults", () => {
    expect(IMAGE_LIMITS.maxImages).toBe(3);
    expect(IMAGE_LIMITS.maxImageBytes).toBe(5 * 1024 * 1024);
    expect(IMAGE_LIMITS.maxTotalBytes).toBe(10 * 1024 * 1024);
  });
});

describe("accumulateImages", () => {
  it("adds new images up to the count limit and reports overflow", () => {
    const { accepted, error } = accumulateImages(
      [sized(10)],
      [sized(10), sized(10), sized(10)]
    );
    expect(accepted).toHaveLength(2);
    expect(error).toContain("at most 3");
  });

  it("adds new images up to the total-byte limit", () => {
    const { accepted, error } = accumulateImages(
      [sized(60)],
      [sized(30), sized(30)],
      { maxImages: 5, maxImageBytes: 1_000, maxTotalBytes: 100 }
    );
    expect(accepted).toHaveLength(1);
    expect(error).toContain("must total");
  });

  it("returns no error when everything fits", () => {
    const { accepted, error } = accumulateImages([], [sized(5)]);
    expect(accepted).toHaveLength(1);
    expect(error).toBeNull();
  });
});

describe("readImageFile", () => {
  const pngBytes = Array.from(atob(PNG_DATA), (c) => c.charCodeAt(0));

  function fileOf(bytes: number[], type: string): File {
    return new File([new Uint8Array(bytes)], "attachment", { type });
  }

  it("reads a valid file into the normalized payload", async () => {
    const result = await readImageFile(fileOf(pngBytes, "image/png"));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.image.mimeType).toBe("image/png");
    expect(result.image.data).toBe(PNG_DATA);
    expect(result.image.byteSize).toBe(pngBytes.length);
    expect(validateImageAttachments([result.image]).ok).toBe(true);
  });

  it("rejects unsupported file types before reading", async () => {
    const result = await readImageFile(fileOf(pngBytes, "image/gif"));
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toContain("Only PNG, JPEG and WebP");
  });

  it("rejects files whose contents do not match their type", async () => {
    const textBytes = Array.from("pretending to be a png").map((c) =>
      c.charCodeAt(0)
    );
    const result = await readImageFile(fileOf(textBytes, "image/png"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("does not match");
  });

  it("rejects oversized files from their byte length", async () => {
    const result = await readImageFile(fileOf(pngBytes, "image/png"), {
      maxImages: 3,
      maxImageBytes: 8,
      maxTotalBytes: 10_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("or smaller");
  });
});

describe("imageDataUrl", () => {
  it("builds a data URL from the normalized payload", () => {
    expect(imageDataUrl(png())).toBe(`data:image/png;base64,${PNG_DATA}`);
  });
});
