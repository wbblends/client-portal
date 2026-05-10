import type { NextConfig } from "next";

/**
 * Baseline security headers, applied to every route.
 *
 * A full nonce-based CSP would need a `proxy.ts` to inject per-request nonces
 * (see `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
 * That path was deliberately not taken — see commit 5c89b9d which removed the
 * proxy in favor of page-level `requireSession()` to keep every route on the
 * Node runtime. So script-src/style-src CSP is left for a future hardening
 * pass; clickjacking is still defended via `frame-ancestors 'none'` (which
 * does not require nonces) plus the legacy `X-Frame-Options` header.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
