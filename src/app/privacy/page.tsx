import type { Metadata } from "next";
import Link from "next/link";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { T } from "@/components/crosscrafted/T";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Privacy Policy | ${BRAND.name}`,
  description:
    `How ${BRAND.name} collects, uses, stores and protects your personal information, with awareness of India's Digital Personal Data Protection Act, 2023 (DPDP Act) and the Digital Personal Data Protection Rules, 2025.`,
  openGraph: {
    title: `Privacy Policy | ${BRAND.name}`,
    siteName: `${BRAND.name}`,
    type: "article",
  },
};

export default function PrivacyPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Heading */}
        <h1 className="text-3xl font-black text-white mb-2"><T k="legal.privacy.title" /></h1>
        <p className="text-sm text-[#A09DB1] mb-6"><T k="legal.privacy.lastUpdated" /></p>

        {/* Legal disclaimer */}
        <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-2xl p-4 mb-8">
          <p className="text-xs text-[#A09DB1] leading-relaxed">
            <T k="legal.disclaimer" />
          </p>
        </div>

        <p className="text-sm text-[#A09DB1] leading-relaxed mb-8"><T k="legal.privacy.1" /> <Link href="/" className="text-[#A78BFA] underline">
            https://www.koino.in
          </Link> <T k="legal.privacy.2" /> <Link href="/terms" className="text-[#A78BFA] underline"><T k="legal.link.terms" /></Link> <T k="legal.privacy.3" /> <Link href="/cookies" className="text-[#A78BFA] underline"><T k="legal.link.cookies" /></Link> <T k="legal.privacy.4" /></p>

        {/* 1. Who Koino Is */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.5" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.6" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.7" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.8" /></p>

        {/* 2. What Information We Collect */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.9" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.10" /></p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li><T k="legal.privacy.11" /></li>
          <li><T k="legal.privacy.12" /></li>
          <li><T k="legal.privacy.13" /></li>
          <li><T k="legal.privacy.14" /></li>
          <li><T k="legal.privacy.15" /></li>
          <li><T k="legal.privacy.16" /></li>
          <li><T k="legal.privacy.17" /></li>
          <li><T k="legal.privacy.18" /></li>
          <li><T k="legal.privacy.19" /></li>
          <li><T k="legal.privacy.20" /></li>
          <li><T k="legal.privacy.21" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.22" /></li>
          <li><T k="legal.privacy.23" /></li>
        </ul>

        {/* 3. Authentication — Google OAuth */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.24" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.25" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.26" /></p>

        {/* 4. Cookies & Local Storage */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.27" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.28" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.29" /> <Link href="/cookies" className="text-[#A78BFA] underline"><T k="legal.link.cookies" /></Link> <T k="legal.privacy.30" /></p>

        {/* 5. Analytics */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.31" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.32" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.33" /></p>

        {/* 6. How We Use Your Information */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.34" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.35" /></p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li><T k="legal.privacy.36" /></li>
          <li><T k="legal.privacy.37" /></li>
          <li><T k="legal.privacy.38" /></li>
          <li><T k="legal.privacy.39" /></li>
          <li><T k="legal.privacy.40" /></li>
          <li><T k="legal.privacy.41" /></li>
        </ul>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.42" /></p>

        {/* 7. Service Providers */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.43" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.44" /></p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li><T k="legal.privacy.45" /></li>
          <li><T k="legal.privacy.46" /></li>
          <li><T k="legal.privacy.47" /></li>
        </ul>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.48" /></p>

        {/* 8. Data Storage */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.49" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.50" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.51" /></p>

        {/* 9. Data Retention */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.52" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.53" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.54" /></p>

        {/* 10. External Links */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.55" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.56" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.57" /></p>

        {/* 11. External Links & Platforms */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.58" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.59" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.60" /></p>

        {/* 12. User Rights */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.61" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.62" /></p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li><T k="legal.privacy.63" /></li>
          <li><T k="legal.privacy.64" /></li>
          <li><T k="legal.privacy.65" /></li>
          <li><T k="legal.privacy.66" /></li>
          <li><T k="legal.privacy.67" /></li>
          <li><T k="legal.privacy.68" /></li>
        </ul>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.69" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.70" /></p>

        {/* 13. Children & Minors */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.71" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.72" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.73" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.74" /></p>

        {/* 14. Security */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.75" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.76" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.77" /></p>

        {/* 15. Changes to This Privacy Policy */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.78" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.79" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.80" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.81" /></p>

        {/* 16. Grievance Officer */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.82" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.83" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.84" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.85" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.86" /></p>

        {/* 17. Contact */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.privacy.87" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.88" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.privacy.89" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.privacy.90" /></p>
      </div>
    </PublicPageLayout>
  );
}
