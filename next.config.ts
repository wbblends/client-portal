import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    turbopackFileSystemCacheForBuild: true,
  },
};

export default nextConfig;
