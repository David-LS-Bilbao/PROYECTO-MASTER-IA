import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs"; // Sprint 15: Sentry integration

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

// 🔍 Sprint 15: Wrap config with Sentry for error tracking and performance monitoring
export default withSentryConfig(nextConfig, {
  // Sentry org (set in .env or leave empty for auto-detection)
  org: process.env.SENTRY_ORG || undefined,

  // Sentry project
  project: process.env.SENTRY_PROJECT || undefined,

  // Auth token for uploading source maps (optional, increases reliability)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  silent: false,

  // Hide source maps from browser to protect source code
  hideSourceMaps: true,

  // Tunnel for CSP compatibility
  tunnelRoute: "/monitoring",
});
