import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/portal/service-worker-register";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Brand fonts — licensed faces shipped in `public/brand/fonts/`.
 *
 * Editor's Note (Production Type): display serif. Regular for headlines and
 * stat numbers; italic is the editorial accent for emphasis words.
 * Sequel Sans Display (Hello Type): variable body sans (weight axis 100–900).
 * Mono uses the platform monospace stack (see `--font-mono` in globals.css) —
 * it only renders codes, IDs and kbd hints, so it isn't worth a font download.
 */

const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "../public/brand/fonts/EditorsNote-Regular.otf", weight: "400", style: "normal" },
    { path: "../public/brand/fonts/EditorsNote-Italic.otf", weight: "400", style: "italic" },
  ],
});

const body = localFont({
  variable: "--font-body",
  display: "swap",
  src: [
    {
      // Regular "Body" cut — despite the "-VF" filename this is a single
      // static weight (no fvar table), so it's pinned to 400.
      path: "../public/brand/fonts/SequelSansDisplay-VF.woff2",
      weight: "400",
      style: "normal",
    },
    {
      // Real Semi Bold Display cut — used by headers. Mapped across the
      // 600-700 range so both font-semibold and font-bold land on this
      // real file instead of triggering a blurry synthesized fake-bold.
      path: "../public/brand/fonts/SequelSansDisplay-Semibold.ttf",
      weight: "600 700",
      style: "normal",
    },
  ],
});

export const metadata: Metadata = {
  title: "WB Blends — Customer Portal",
  description: "Orders, invoices, documents, and account contacts for WB Blends customers.",
  applicationName: "WB Blends",
  appleWebApp: {
    capable: true,
    title: "WB Blends",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/brand/wb-mark.png",
    shortcut: "/brand/wb-mark.png",
    apple: "/brand/wb-mark.png",
  },
};

/**
 * `viewport-fit=cover` lets us reach under the iOS notch/home-indicator and
 * pair with `env(safe-area-inset-*)` in CSS. `maximumScale: 1` keeps iOS from
 * zooming forms with <16px text, but we leave `userScalable` on so the user
 * can still pinch-zoom for accessibility.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6540e3",
};

/**
 * Pre-paint theme script. Runs before React hydrates so the page never flashes
 * the wrong theme on initial load. Reads the user's saved preference from
 * localStorage; defaults to light if nothing's stored. Kept inline (not a
 * module) so it can run synchronously in the document head.
 */
const themeBootScript = `
(function () {
  try {
    var saved = localStorage.getItem('wbb.theme');
    var theme = saved === 'dark' || saved === 'light' ? saved : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full text-foreground">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
