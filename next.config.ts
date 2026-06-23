import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The Quote Builder generate route reads the two template PDFs off disk at
  // runtime. Next's tracer can't see a runtime fs.readFile, so name the files
  // explicitly to guarantee they're bundled into the serverless function.
  outputFileTracingIncludes: {
    "/api/tools/quote-builder/generate": ["./lib/quote-builder/templates/**"],
  },
  // NOTE: experimental.turbopackFileSystemCacheForBuild was removed — the
  // persistent Turbopack build cache it produced was being restored by
  // Vercel and crashing every deploy at "Applying modifyConfig from Vercel"
  // (TypeError: The "path" argument must be of type string. Received
  // undefined). The build is otherwise healthy. Re-enable only once that
  // interaction is fixed upstream, and clear the Vercel build cache first.
};

export default nextConfig;
