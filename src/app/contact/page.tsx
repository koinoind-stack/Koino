import type { Metadata } from "next";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import ContactPageClient from "./ContactPageClient";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Contact Us | ${BRAND.name}`,
  description:
    `Get in touch with the ${BRAND.name} team. Report a problem, request a feature, ask about partnerships, or send us a general inquiry.`,
  openGraph: {
    title: `Contact Us | ${BRAND.name}`,
    description: `Get in touch with the ${BRAND.name} team.`,
    siteName: `${BRAND.name}`,
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <PublicPageLayout>
      <ContactPageClient />
    </PublicPageLayout>
  );
}
