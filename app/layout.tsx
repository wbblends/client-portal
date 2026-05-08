import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
// import localFont from "next/font/local";
import "./globals.css";

/**
 * Brand fonts.
 *
 * Production fonts are paid licenses (Editor's Note by Production Type +
 * Sequel Sans Display by Hello Type). Drop the .woff2 files into
 * `public/brand/fonts/` and swap the `localFont` blocks below in for the
 * Google fallbacks. The CSS variable names (`--font-display`, `--font-body`)
 * stay the same so nothing else has to change.
 */

const displayFallback = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const bodyFallback = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// const display = localFont({
//   variable: "--font-display",
//   src: [
//     { path: "../public/brand/fonts/EditorsNote-Regular.woff2", weight: "400", style: "normal" },
//     { path: "../public/brand/fonts/EditorsNote-Italic.woff2", weight: "400", style: "italic" },
//     { path: "../public/brand/fonts/EditorsNote-Semibold.woff2", weight: "600", style: "normal" },
//   ],
// });
//
// const body = localFont({
//   variable: "--font-body",
//   src: [
//     { path: "../public/brand/fonts/SequelSansDisplay-Regular.woff2", weight: "400", style: "normal" },
//     { path: "../public/brand/fonts/SequelSansDisplay-Medium.woff2", weight: "500", style: "normal" },
//     { path: "../public/brand/fonts/SequelSansDisplay-Semibold.woff2", weight: "600", style: "normal" },
//   ],
// });

export const metadata: Metadata = {
  title: "WB Blends — Customer Portal",
  description: "Orders, invoices, documents, and account contacts for WB Blends customers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFallback.variable} ${bodyFallback.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-surface text-foreground">{children}</body>
    </html>
  );
}
