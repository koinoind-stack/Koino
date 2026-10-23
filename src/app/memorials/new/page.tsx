import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import MemorialForm from "@/components/memorials/MemorialForm";

export const metadata: Metadata = {
  title: "Create a Memorial — In Loving Memory | Koino",
  description:
    "Create a peaceful memorial page for a deceased loved one — their life story, photographs, favourite Bible verses, memories, and condolences.",
  robots: { index: false, follow: false },
};

export default function NewMemorialPage() {
  return (
    <PublicPageLayout>
      <MemorialForm mode="create" />
    </PublicPageLayout>
  );
}
