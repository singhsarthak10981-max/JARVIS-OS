import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the sandbox / tunnel preview host (and any subdomain) to talk to
  // the dev server. Production deployments are unaffected.
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost", "127.0.0.1"],
};

export default nextConfig;
