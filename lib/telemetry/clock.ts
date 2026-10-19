/**
 * Monotonic clock for browser-perceived durations.
 *
 * `performance.now()` is monotonic and unaffected by wall-clock changes, which
 * is what a latency measurement needs. `Date.now()` is only a fallback for
 * environments without `performance`, and every duration derived from the
 * result is clamped before it can be persisted.
 */
export function nowMs(): number {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}
