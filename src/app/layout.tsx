import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
// Indic UI fonts — Devanagari (Hindi) and Telugu script renderers so the
// translated interface uses proper, consistently-shaped glyphs on every
// platform instead of falling back to whatever the OS happens to provide.
//
// ALL three fonts are loaded LOCALLY (next/font/local + the geist npm package
// which itself wraps next/font/local). The previous next/font/google imports
// fetched font CSS/woff2 from Google Fonts at build time — a build-time network
// dependency that intermittently broke Vercel production builds with
// "module-not-found" errors on the noto_sans_devanagari CSS file. Local fonts
// eliminate that flake entirely: no build-time network fetch, no DNS failure,
// no intermittent deploy breakage.
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/crosscrafted/Providers";
import ServiceWorkerRegister from "./register-sw";
import { BRAND, SITE_TITLE, siteUrl } from "@/lib/brand";

const geistSans = GeistSans;

const notoDevanagari = localFont({
  src: "../../public/fonts/NotoSansDevanagari.ttf",
  variable: "--font-devanagari",
  weight: "100 900",
  display: "swap",
});

const notoTelugu = localFont({
  src: "../../public/fonts/NotoSansTelugu.ttf",
  variable: "--font-telugu",
  weight: "100 900",
  display: "swap",
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
    icon: BRAND.assets.logo,
    apple: BRAND.assets.logo,
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
      <body className={`${geistSans.variable} ${notoDevanagari.variable} ${notoTelugu.variable} antialiased bg-[#12101A] text-white`}>
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
