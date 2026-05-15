import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/portal/service-worker-register";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Brand fonts — licensed faces shipped in `public/brand/fonts/`.
 *
 * Editor's Note (Production Type): display serif. Regular for headlines and
 * stat numbers; italic is the editorial accent for emphasis words.
 * Sequel Sans Display (Hello Type): variable body sans (weight axis 100–900).
 * Mono falls back to Geist Mono — used only for codes, IDs, kbd hints.
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
      path: "../public/brand/fonts/SequelSansDisplay-VF.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full bg-surface text-foreground">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
