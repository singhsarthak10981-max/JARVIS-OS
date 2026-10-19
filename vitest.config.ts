import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` is a Next.js bundler guard: it throws if a module is
      // pulled into a client bundle. Under Vitest there is no client bundle,
      // so alias it to an empty module and let the real server code be tested.
      "server-only": path.resolve(__dirname, "lib/ai/__tests__/server-only.stub.ts"),
    },
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    environment: "node",
    reporters: "default",
  },
});
