import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The bundler doesn't auto-include the .sql schema or .json seed file
  // that lib/db/index.ts reads via fs.readFileSync at runtime. Force-include
  // them in every route's trace so they ship with the function on Vercel.
  outputFileTracingIncludes: {
    "/*": ["lib/db/schema.sql", "lib/users/users.json"],
  },
};

export default nextConfig;
