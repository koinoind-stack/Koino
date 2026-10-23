import type { Metadata } from "next";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import PartnerPageClient from "./PartnerPageClient";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Partner With ${BRAND.name} — Christian Leaders, Teachers & Contributors`,
  description:
    `${BRAND.name} welcomes Christian leaders, teachers, pastors, apologists, authors, and content creators to contribute to a platform built for faith, fellowship, and belonging.`,
  openGraph: {
    title: `Partner With ${BRAND.name}`,
    description: "Help Christians grow in faith through your teaching, experience, and biblical knowledge.",
    siteName: `${BRAND.name}`,
    type: "website",
  },
};

export default function PartnerPage() {
  return (
    <PublicPageLayout>
      <PartnerPageClient />
    </PublicPageLayout>
  );
}
