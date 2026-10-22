import type { Metadata } from "next";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import PartnerPageClient from "./PartnerPageClient";

export const metadata: Metadata = {
  title: "Partner With Koino — Christian Leaders, Teachers & Contributors",
  description:
    "Koino welcomes Christian leaders, teachers, pastors, apologists, authors, and content creators to contribute to a platform built for faith, fellowship, and belonging.",
  openGraph: {
    title: "Partner With Koino",
    description: "Help Christians grow in faith through your teaching, experience, and biblical knowledge.",
    siteName: "Koino",
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
