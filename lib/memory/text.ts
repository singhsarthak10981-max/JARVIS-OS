/**
 * Memory text helpers shared by the browser and the server.
 *
 * These two pure functions used to live in `lib/memory/context.ts`, which
 * starts with `import "server-only"`. Explicit recall composes its answer in
 * the browser from both memory stores, so they moved here to a module with no
 * server-only or database imports; `context.ts` re-exports them unchanged so
 * every existing import keeps working with identical semantics.
 */

/** Normal form for duplicate comparisons between the two memory stores. */
export function normalizeMemoryText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when two already-normalised texts say the same thing closely enough
 * that storing/injecting both is noise: equal, or one contains the other.
 * The length floor keeps short values ("black") from swallowing longer,
 * more informative ones ("black, no sugar").
 */
export function isNearDuplicateValue(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 8 && longer.includes(shorter);
}
