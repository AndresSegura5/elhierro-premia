import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  typedRoutes: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ] }];
  },
};

export default nextConfig;
