import type { Metadata } from "next";
import Link from "next/link";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { T } from "@/components/crosscrafted/T";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Cookie Policy | ${BRAND.name}`,
  description:
    `How ${BRAND.name} uses cookies and local storage to keep you signed in, remember your preferences, and provide core platform features. ${BRAND.name} does not use advertising cookies or third-party tracking pixels.`,
  openGraph: {
    title: `Cookie Policy | ${BRAND.name}`,
    siteName: `${BRAND.name}`,
    type: "article",
  },
};

export default function CookiesPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Heading */}
        <h1 className="text-3xl font-black text-white mb-2"><T k="legal.cookies.title" /></h1>
        <p className="text-sm text-[#A09DB1] mb-6"><T k="legal.cookies.lastUpdated" /></p>

        {/* Legal disclaimer */}
        <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-2xl p-4 mb-8">
          <p className="text-xs text-[#A09DB1] leading-relaxed">
            <T k="legal.disclaimer" />
          </p>
        </div>

        <p className="text-sm text-[#A09DB1] leading-relaxed mb-8"><T k="legal.cookies.1" /> <Link href="/" className="text-[#A78BFA] underline">
            https://www.koino.in
          </Link> <T k="legal.cookies.2" /> <Link href="/privacy" className="text-[#A78BFA] underline"><T k="legal.link.privacy" /></Link> <T k="legal.cookies.3" /> <Link href="/terms" className="text-[#A78BFA] underline"><T k="legal.link.terms" /></Link> <T k="legal.cookies.4" /></p>

        {/* 1. What cookies / local storage are */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.5" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.6" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.7" /></p>

        {/* 2. Essential cookies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.8" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.9" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.10" /></p>

        {/* 3. Authentication / session technologies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.11" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.12" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.13" /></p>

        {/* 4. Preferences */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.14" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.15" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.16" /></p>

        {/* 5. Service Worker */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.17" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.18" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.19" /></p>

        {/* 6. Analytics */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.20" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.21" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.22" /></p>

        {/* 7. Third-Party Technologies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.23" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.24" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.25" /></p>

        {/* 8. What Koino Does NOT Use */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.26" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.27" /></p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li><T k="legal.cookies.28" /></li>
          <li><T k="legal.cookies.29" /></li>
          <li><T k="legal.cookies.30" /></li>
          <li><T k="legal.cookies.31" /></li>
          <li><T k="legal.cookies.32" /></li>
        </ul>

        {/* 9. How Users Can Manage Cookies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.33" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.34" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.35" /></p>

        {/* 10. Impact of Disabling */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.36" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.37" /></p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li><T k="legal.cookies.38" /></li>
          <li><T k="legal.cookies.39" /></li>
          <li><T k="legal.cookies.40" /></li>
          <li><T k="legal.cookies.41" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.cookies.42" /></li>
        </ul>

        {/* 11. Changes to This Policy */}
        <h2 className="text-base font-bold text-white mt-8 mb-3"><T k="legal.cookies.43" /></h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.44" /></p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4"><T k="legal.cookies.45" /> <Link href="/contact" className="text-[#A78BFA] underline"><T k="legal.link.contactPage" /></Link> <T k="legal.cookies.46" /></p>
      </div>
    </PublicPageLayout>
  );
}
