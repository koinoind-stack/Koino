import type { Metadata } from "next";
import { Geist } from "next/font/google";
// Indic UI fonts — Devanagari (Hindi) and Telugu script renderers so the
// translated interface uses proper, consistently-shaped glyphs on every
// platform instead of falling back to whatever the OS happens to provide.
import { Noto_Sans_Devanagari } from "next/font/google";
import { Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/crosscrafted/Providers";
import ServiceWorkerRegister from "./register-sw";
import { BRAND, SITE_TITLE, siteUrl } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

const notoTelugu = Noto_Sans_Telugu({
  variable: "--font-telugu",
  subsets: ["telugu"],
  weight: ["400", "500", "600", "700"],
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
      <body className={`${geistSans.variable} ${notoDevanagari.variable} ${notoTelugu.variable} geist_a71539c9-module__T19VSG__variable antialiased bg-[#071120] text-white`}>
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
