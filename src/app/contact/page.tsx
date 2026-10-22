import type { Metadata } from "next";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import ContactPageClient from "./ContactPageClient";

export const metadata: Metadata = {
  title: "Contact Us | Koino",
  description:
    "Get in touch with the Koino team. Report a problem, request a feature, ask about partnerships, or send us a general inquiry.",
  openGraph: {
    title: "Contact Us | Koino",
    description: "Get in touch with the Koino team.",
    siteName: "Koino",
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
