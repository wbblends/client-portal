import type { MetadataRoute } from "next";

/**
 * PWA manifest. Declared as a TypeScript route (Next 16 picks it up
 * automatically and serves it at `/manifest.webmanifest`).
 *
 * Once installed the portal launches in `standalone` so the browser chrome
 * disappears — feels like a native app on the home screen. The icons reuse
 * the existing brand mark; for production we'd want dedicated maskable icon
 * versions in 192/512, but the lockup PNG is enough for the install banner
 * and home-screen icon today.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WB Blends Customer Portal",
    short_name: "WB Blends",
    description:
      "Orders, invoices, documents, and account contacts for WB Blends customers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ff",
    theme_color: "#6e5bfe",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/brand/wb-mark.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/full-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
