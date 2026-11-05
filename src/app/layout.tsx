import type { Metadata } from "next";
// Fonts are self-hosted via next/font/local (files under src/fonts/, all
// SIL OFL 1.1 licensed — see each directory's license file). The previous
// next/font/google setup downloaded font data from fonts.googleapis.com
// during `next build`, which fails on build runners without access to
// Google (Vercel: BUILD_UTILS_SPAWN_1 on the generated noto_sans_telugu
// module). Same CSS variables, weight ranges and language coverage as
// before: Latin → Geist, Devanagari (Hindi) → Noto Sans Devanagari,
// Telugu → Noto Sans Telugu, composed per glyph by the --font-sans stack
// in globals.css so the translated interface keeps proper, consistently
// shaped glyphs on every platform. The files are full-coverage variable
// fonts, so every previously supported subset/script still renders with
// Geist/Noto glyphs instead of OS fallbacks.
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/crosscrafted/Providers";
import ServiceWorkerRegister from "./register-sw";
import { BRAND, SITE_TITLE, siteUrl } from "@/lib/brand";

const geistSans = localFont({
  src: "../fonts/geist/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const notoDevanagari = localFont({
  src: "../fonts/noto-sans-devanagari/NotoSansDevanagari-Variable.woff2",
  variable: "--font-devanagari",
  display: "swap",
  weight: "400 700",
});

const notoTelugu = localFont({
  src: "../fonts/noto-sans-telugu/NotoSansTelugu-Variable.woff2",
  variable: "--font-telugu",
  display: "swap",
  weight: "400 700",
});

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
    icon: BRAND.assets.favicon,
    shortcut: BRAND.assets.favicon,
    apple: BRAND.assets.appleTouchIcon,
  },
  openGraph: {
    title: SITE_TITLE,
    description:
      "Connect, grow and belong with the Christian community on Lordsbook.",
    siteName: BRAND.name,
    type: "website",
    images: [BRAND.assets.logo],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.tagline,
    images: [BRAND.assets.logo],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${geistSans.variable} ${notoDevanagari.variable} ${notoTelugu.variable} antialiased bg-[#071120] text-white`}>
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
