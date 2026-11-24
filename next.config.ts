import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), payment=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const privateHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
  { key: "Pragma", value: "no-cache" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "32mb",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/evaluator/:path*", headers: privateHeaders },
      { source: "/institution/:path*", headers: privateHeaders },
      { source: "/monitoring/:path*", headers: privateHeaders },
      { source: "/login", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
