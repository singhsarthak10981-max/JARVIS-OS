import type { NextConfig } from "next";
import path from "node:path";

/**
 * Pin the workspace root to this package.
 *
 * The app can live in a folder whose parent also contains a lockfile (for
 * example `D:\JARVIS OS\package-lock.json` above `frontend/`). Next then
 * infers the parent as the workspace root, warns about it, and widens file
 * tracing. `turbopack.root` and `outputFileTracingRoot` state the intended
 * root explicitly instead, without touching the parent project.
 *
 * `__dirname` is defined because Next transpiles this config to CommonJS;
 * the `typeof` guard keeps it working if that ever changes.
 */
const projectRoot = typeof __dirname === "string" ? __dirname : process.cwd();

const nextConfig: NextConfig = {
  // Allow the sandbox / tunnel preview host (and any subdomain) to talk to
  // the dev server. Production deployments are unaffected.
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost", "127.0.0.1"],
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: path.resolve(projectRoot),
};

export default nextConfig;
