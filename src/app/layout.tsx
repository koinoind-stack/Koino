import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/crosscrafted/Providers";
import ServiceWorkerRegister from "./register-sw";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://www.koino.in"
      : "http://localhost:3000")
  ),
  title: "Koino — Faith. Fellowship. Belong.",
  description:
    "Koino is a Christian community platform for Scripture, churches, prayer, events, Bible trivia, Christian businesses, marketplace and fellowship.",
  keywords: [
    "Koino",
    "Koinonia",
    "Christian community",
    "Bible trivia",
    "church directory India",
    "apologetics",
    "prayer wall",
    "Christian marketplace",
    "Christian business directory",
  ],
  authors: [{ name: "Koino Team" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/koino-logo.png",
    apple: "/koino-logo.png",
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
