import type { Metadata } from "next";

import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import MemorialManage from "@/components/memorials/MemorialManage";

export const metadata: Metadata = {
  title: "Manage Memorial — In Loving Memory | Koino",
  robots: { index: false, follow: false },
};

export default async function ManageMemorialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PublicPageLayout>
      <MemorialManage memorialId={id} />
    </PublicPageLayout>
  );
}
