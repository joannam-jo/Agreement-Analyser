import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@faa/shared"],
  poweredByHeader: false,
  // Allows a separate build folder, e.g. for the public demo build next to a dev build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The web app forwards /api to the backend, so a single public address serves both
  // (the backend itself never needs to be exposed).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/:path*` }];
  },
  experimental: {
    // Uploads (up to 20 MB) pass through the proxy.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
