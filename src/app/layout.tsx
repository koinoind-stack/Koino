import type { Metadata } from "next";
import { Geist } from "next/font/google";
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
      <body className="geist_a71539c9-module__T19VSG__variable antialiased bg-[#12101A] text-white">
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
