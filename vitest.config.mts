import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Loaded as a native ES module (`.mts`).
 *
 * Vite's `configLoader: 'native'` — which is becoming the default — warns when
 * an ESM-syntax config is loaded as CommonJS. A `.mts` extension states the
 * module format explicitly: no suppression flag, no `"type": "module"` flip on
 * the whole package, and no dependency change.
 *
 * Local setup data (`.jarvis-data/`) is never read by tests; telemetry tests
 * point `JARVIS_DATA_DIR` at a temporary directory.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": here,
      // `server-only` is a Next.js bundler guard: it throws if a module is
      // pulled into a client bundle. Under Vitest there is no client bundle,
      // so alias it to an empty module and let the real server code be tested.
      "server-only": path.resolve(here, "lib/ai/__tests__/server-only.stub.ts"),
    },
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    environment: "node",
    reporters: "default",
  },
});
