import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev only: let the Cloudflare quick tunnel (used to reach the dev server from phones) load
  // HMR and other dev resources. Quick-tunnel hostnames are random per run, hence the wildcard.
  allowedDevOrigins: ["*.trycloudflare.com"],
  // @cline/* packages use dynamic requires that Turbopack cannot bundle; load them from node_modules at runtime.
  serverExternalPackages: ["@cline/sdk", "@cline/core", "@cline/llms", "@cline/agents", "@cline/shared"],
  turbopack: {}, // Silences Turbopack error caused by next-pwa's webpack config injection
};

export default withPWA(nextConfig as any);