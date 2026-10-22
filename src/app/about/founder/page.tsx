import type { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { Sparkles } from "lucide-react";

const db = new PrismaClient();

export const metadata: Metadata = {
  title: "Meet the Founder — Koino",
  description: "Meet the founder of Koino. Learn why Koino was built and the vision behind the platform.",
  openGraph: {
    title: "Meet the Founder — Koino",
    description: "Meet the founder of Koino.",
    siteName: "Koino",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default async function FounderPage() {
  // Read founder profile from DB — falls back to placeholder if not yet configured
  const founder = await db.founderProfile.findFirst({
    where: { published: true },
  });

  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {founder ? (
          // ─── Real founder profile from DB ───
          <div className="space-y-8">
            <div className="text-center">
              {founder.profilePhoto && (
                <img
                  src={founder.profilePhoto}
                  alt={founder.founderName}
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-2 border-[#F39B9B]/30"
                />
              )}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-3">
                <Sparkles size={12} fill="currentColor" /> Meet the Founder
              </div>
              <h1 className="text-2xl font-black text-white mb-1">{founder.founderName}</h1>
              {founder.shortIntro && (
                <p className="text-sm text-[#A09DB1]">{founder.shortIntro}</p>
              )}
            </div>

            {founder.whyIBuiltKoino && (
              <div>
                <h2 className="text-lg font-bold text-white mb-3">Why I Built Koino</h2>
                <p className="text-sm text-[#A09DB1] leading-relaxed whitespace-pre-wrap">{founder.whyIBuiltKoino}</p>
              </div>
            )}

            {founder.vision && (
              <div>
                <h2 className="text-lg font-bold text-white mb-3">My Vision for Koino</h2>
                <p className="text-sm text-[#A09DB1] leading-relaxed whitespace-pre-wrap">{founder.vision}</p>
              </div>
            )}

            {founder.mission && (
              <div>
                <h2 className="text-lg font-bold text-white mb-3">Mission</h2>
                <p className="text-sm text-[#A09DB1] leading-relaxed whitespace-pre-wrap">{founder.mission}</p>
              </div>
            )}

            {founder.founderMessage && (
              <div>
                <h2 className="text-lg font-bold text-white mb-3">A Message from the Founder</h2>
                <p className="text-sm text-[#A09DB1] leading-relaxed whitespace-pre-wrap">{founder.founderMessage}</p>
              </div>
            )}

            {founder.email && (
              <div className="text-center pt-4">
                <a
                  href={`mailto:${founder.email}`}
                  className="px-6 py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all"
                >
                  Contact Founder
                </a>
              </div>
            )}
          </div>
        ) : (
          // ─── Placeholder (no founder profile published yet) ───
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#F39B9B] to-[#7C3AED] flex items-center justify-center">
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles size={12} fill="currentColor" /> Meet the Founder
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Meet the Founder</h1>
            <p className="text-sm text-[#A09DB1] leading-relaxed max-w-md mx-auto mb-6">
              The founder profile is being prepared. Please check back soon to learn the story
              behind Koino and the vision that drives it.
            </p>
            <a href="/about" className="text-[#A78BFA] text-xs font-bold hover:text-white transition-colors">
              ← Back to About Koino
            </a>
          </div>
        )}
      </div>
    </PublicPageLayout>
  );
}
