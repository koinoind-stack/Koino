import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
// Indic UI fonts — Devanagari (Hindi) and Telugu script renderers so the
// translated interface uses proper, consistently-shaped glyphs on every
// platform instead of falling back to whatever the OS happens to provide.
//
// ALL fonts are loaded LOCALLY: no build-time network fetch (the previous
// next/font/google imports intermittently broke Vercel production builds
// with "module-not-found" errors on the noto_sans_devanagari CSS file).
//
// PERF (launch audit): the Devanagari/Telugu faces are NOT loaded through
// next/font/local anymore — that preloaded BOTH full TTFs (628KB + 868KB)
// on every page for every visitor, including English-only readers. They are
// now plain self-hosted WOFF2 subsets (216KB + 244KB) declared in
// globals.css with `unicode-range`, so the browser downloads a face ONLY
// when the page actually renders that script: 0 bytes for English visits,
// one face for Hindi or Telugu visits. The original TTFs stay in
// public/fonts — the server-side share-card renderer reads them from disk.
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/crosscrafted/Providers";
import ServiceWorkerRegister from "./register-sw";
import { BRAND, SITE_TITLE, siteUrl } from "@/lib/brand";

const geistSans = GeistSans;

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: SITE_TITLE,
  description: BRAND.description,
  keywords: [
    BRAND.name,
    "Koinonia",
    "Christian community",
    "Bible trivia",
    "church directory India",
    "apologetics",
    "prayer wall",
    "Christian marketplace",
    "Christian business directory",
  ],
  authors: [{ name: `${BRAND.name} Team` }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: BRAND.assets.icon192,
    apple: BRAND.assets.appleTouchIcon,
  },
  openGraph: {
    title: "Koino — Faith. Fellowship. Belong.",
    description:
      "Connect, grow and belong with the Christian community on Koino.",
    siteName: "Koino",
    type: "website",
    images: ["/koino-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Koino",
    description: "Faith. Fellowship. Belong.",
    images: ["/koino-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geistSans.variable} antialiased bg-[#090D18] text-white`}>
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster position="top-center" />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}
