import type { Metadata } from "next";
import Link from "next/link";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { T } from "@/components/crosscrafted/T";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Terms of Service | ${BRAND.name}`,
  description:
    `The terms that govern your use of ${BRAND.name}, a Christian community platform at https://www.koino.in. By creating an account or using any ${BRAND.name} feature, you agree to these terms.`,
  openGraph: {
    title: `Terms of Service | ${BRAND.name}`,
    siteName: `${BRAND.name}`,
    type: "article",
  },
};

export default function TermsPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Heading */}
        <h1 className="text-3xl font-black text-white mb-2"><T k="legal.terms.title" /></h1>
        <p className="text-sm text-[#A09DB1] mb-6"><T k="legal.terms.lastUpdated" /></p>

        {/* Legal disclaimer */}
        <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-2xl p-4 mb-8">
          <p className="text-xs text-[#A09DB1] leading-relaxed">
            <T k="legal.disclaimer" />
          </p>
        </div>

        <p className="text-sm text-[#A09DB1] leading-relaxed mb-8"><T k="legal.terms.1" /> <Link href="/" className="text-[#A78BFA] underline">
            https://www.koino.in
          </Link> <T k="legal.terms.2" /></p>

        {/* 1. Acceptance of Terms */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.3" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.4" /></p>

        {/* 2. Eligibility */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.5" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.6" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.terms.7" /></p>

        {/* 3. Accounts */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.8" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.9" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.10" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.terms.11" /></p>

        {/* 4. User Responsibilities */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.12" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.13" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.14" /></p>

        {/* 5. Christian Community Conduct */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.15" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.16" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.17" /></p>

        {/* 6. User-Generated Content */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.18" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.19" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.20" /></p>

        {/* 7. Bible & Educational Content Disclaimer */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.21" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.22" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.23" /></p>

        {/* 8. Bible Trivia, Faith Points & Competitions */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.24" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.25" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.26" /></p>

        {/* 9. Churches & Events */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.27" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.28" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.29" /></p>

        {/* 10. Marketplace & Business Directory */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.30" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.31" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.32" /></p>

        {/* 11. Contributor Content */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.33" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.34" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.35" /></p>

        {/* 12. Intellectual Property */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.36" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.37" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.38" /></p>

        {/* 13. External Links */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.39" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.40" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.41" /></p>

        {/* 14. Donations & Support */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.42" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.43" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.44" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.terms.45" /></p>

        {/* 15. Moderation */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.46" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.47" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.48" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.terms.49" /></p>

        {/* 16. Suspension & Blocking */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.50" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.51" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.52" /></p>

        {/* 17. Availability */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.53" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.54" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.55" /></p>

        {/* 18. Disclaimer of Warranties */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.56" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.57" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.58" /></p>

        {/* 19. Limitation of Liability */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.59" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.60" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.61" /></p>

        {/* 20. Changes to Terms */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.62" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.63" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.64" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.terms.65" /></p>

        {/* 21. Governing Law & Jurisdiction */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.66" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.67" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.68" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.terms.69" /></p>

        {/* 22. Contact */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.terms.70" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.71" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.terms.72" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.terms.73" /></p>
      </div>
    </PublicPageLayout>
  );
}
