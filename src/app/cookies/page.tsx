import type { Metadata } from "next";
import Link from "next/link";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";

export const metadata: Metadata = {
  title: "Cookie Policy | Koino",
  description:
    "How Koino uses cookies and local storage to keep you signed in, remember your preferences, and provide core platform features. Koino does not use advertising cookies or third-party tracking pixels.",
  openGraph: {
    title: "Cookie Policy | Koino",
    siteName: "Koino",
    type: "article",
  },
};

export default function CookiesPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Heading */}
        <h1 className="text-3xl font-black text-white mb-2">Cookie Policy</h1>
        <p className="text-sm text-[#A09DB1] mb-6">Last updated: October 7, 2026</p>

        {/* Legal disclaimer */}
        <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-2xl p-4 mb-8">
          <p className="text-xs text-[#A09DB1] leading-relaxed">
            This document is provided for informational purposes and does not constitute legal advice.
            Have it reviewed by qualified legal counsel before relying on it.
          </p>
        </div>

        <p className="text-sm text-[#A09DB1] leading-relaxed mb-8">
          This Cookie Policy explains how Koino uses cookies, browser local storage and similar
          technologies when you visit{" "}
          <Link href="/" className="text-[#A78BFA] underline">
            https://www.koino.in
          </Link>{" "}
          and use our services (the &quot;Services&quot;). It is intended to be read together with our{" "}
          <Link href="/privacy" className="text-[#A78BFA] underline">
            Privacy Policy
          </Link>{" "}
          and our{" "}
          <Link href="/terms" className="text-[#A78BFA] underline">
            Terms of Service
          </Link>
          . We have written this policy in plain language so it is accessible to non-lawyers, but it
          should be reviewed by qualified legal counsel before being relied upon.
        </p>

        {/* 1. What cookies / local storage are */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          1. What Cookies &amp; Local Storage Are
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          A cookie is a small text file that a website places in your browser when you visit it. Cookies
          allow the website to remember things about your visit across page loads, such as that you are
          signed in, what language you prefer, or what is in a shopping cart. Local storage is similar,
          but instead of being sent with every request, it stays in your browser and can be read by the
          website on subsequent visits.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Cookies and local storage can be &quot;first-party&quot; (set by the website you are visiting)
          or &quot;third-party&quot; (set by another domain, typically for advertising or analytics).
          Koino uses only first-party cookies and local storage for the core functions described in this
          policy. We do not use third-party advertising cookies or third-party tracking pixels.
        </p>

        {/* 2. Essential cookies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">2. Essential Cookies</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Essential cookies are cookies that Koino needs in order to function at all. The most important
          of these are the Supabase Auth session cookies, which are required for sign-in. When you sign
          in with email and password or with Google OAuth, Supabase Auth sets secure, HTTP-only session
          cookies in your browser. These cookies allow Koino to recognise you on each subsequent page
          load so that you stay signed in without having to enter your credentials again.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Without these essential cookies, the sign-in feature cannot work. If you disable or clear
          these cookies, you will be signed out and will need to sign in again to access account-only
          features such as the prayer wall, trivia, marketplace and business directory. Because these
          cookies are strictly necessary to provide the service you have requested, Koino sets them
          without first asking for separate consent, as permitted under applicable law.
        </p>

        {/* 3. Authentication / session technologies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          3. Authentication &amp; Session Technologies
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino uses Supabase Auth for session management. When you sign in, Supabase Auth issues a
          session that is stored in your browser as HTTP-only cookies. HTTP-only cookies cannot be read
          by JavaScript running in the page, which reduces the risk of session theft by malicious scripts
          (for example, in cross-site scripting attacks). The cookies are also set with the Secure
          attribute, which means they are only sent over an encrypted HTTPS connection.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          The session cookies allow Koino&apos;s server-side code to verify who you are on each request
          and to load your profile, prayer requests, trivia participation and other account data. The
          cookies do not contain your password; they contain an opaque session token that Supabase Auth
          validates against its secure backend. You can invalidate all sessions at any time by signing
          out, and the cookies will no longer grant access.
        </p>

        {/* 4. Preferences */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">4. Preferences</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino remembers certain preferences so that you do not have to set them every time you visit.
          For example, the language you choose for the Koino interface is stored in a cookie or in
          browser local storage so that the platform loads in your preferred language the next time you
          visit. Other preferences, such as whether you have dismissed an announcement banner or which
          Bible translation you last read, may also be stored locally in your browser.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Preference cookies and local storage items are not strictly necessary for sign-in, but they
          make Koino more pleasant to use. If you clear them, your preferences will reset to defaults
          (for example, the interface language will reset to English) but you will not be signed out as
          long as your session cookie remains in place.
        </p>

        {/* 5. Service Worker */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">5. Service Worker</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino can be installed as a Progressive Web App (PWA) on supported devices. To enable this,
          Koino registers a service worker (a small script that runs in your browser in the background)
          that caches the app shell so that Koino loads quickly and can be opened even when you are
          offline. The service worker is registered on your device only after you visit Koino; it does
          not run on servers operated by Koino.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          The service worker caches static assets such as HTML, CSS, JavaScript, fonts and images so
          that the basic app shell can load without a network connection. It does NOT cache
          authenticated API responses, your private prayer requests, your trivia answers or any other
          data that requires you to be signed in. When you interact with authenticated features, the
          service worker passes those requests through to the network so they are handled by Koino&apos;s
          servers in real time. You can remove the service worker at any time by clearing site data in
          your browser settings.
        </p>

        {/* 6. Analytics */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">6. Analytics</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino uses basic server-side event tracking to understand how the platform is used and to
          improve it. When you perform certain actions, the platform sends a small event payload via a
          POST request to our own endpoint at <code className="text-[#A78BFA]">/api/track</code>. This
          tracking happens on the server side and does not rely on cookies.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino does not use third-party analytics cookies. We do not use Google Analytics, Facebook
          Pixel, advertising cookies, fingerprinting or any similar third-party tracking technology at
          this time. Because our analytics is server-side and first-party, it does not create
          third-party tracking profiles of you across other websites.
        </p>

        {/* 7. Third-Party Technologies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">7. Third-Party Technologies</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          The main third-party technology that touches the sign-in flow is Google OAuth. When you choose
          to sign in with Google, your browser is briefly redirected to a Google-owned domain where you
          authenticate with Google. During that flow, Google may set its own cookies on its own domain.
          Those cookies are governed by Google&apos;s privacy policy and cookie policy, not by Koino.
          Once Google redirects you back to Koino, no Google-owned cookies continue to track you on
          Koino.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Some pages on Koino may contain links to external platforms such as Lordsbook
          (https://www.lordsbook.com) or to a WhatsApp channel. Those external platforms may set their
          own cookies when you visit them. Koino does not control and is not responsible for the cookies
          set by external platforms. You should review the cookie and privacy policies of any external
          platform you visit.
        </p>

        {/* 8. What Koino Does NOT Use */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">8. What Koino Does NOT Use</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          To be clear about the limits of Koino&apos;s use of cookies and similar technologies, the
          following are NOT used on Koino at the time of writing:
        </p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li>
            <span className="text-white font-bold">No advertising cookies.</span> Koino does not show
            advertisements and does not use advertising networks that set cookies to build advertising
            profiles.
          </li>
          <li>
            <span className="text-white font-bold">No third-party tracking pixels.</span> Koino does not
            embed third-party tracking pixels (such as the Facebook Pixel) on its pages.
          </li>
          <li>
            <span className="text-white font-bold">No social media tracking.</span> Koino does not embed
            third-party social media widgets that track you across other websites. Social media links,
            where present, take you to the external platform rather than embedding its trackers on
            Koino.
          </li>
          <li>
            <span className="text-white font-bold">No third-party analytics.</span> Koino does not use
            third-party analytics services such as Google Analytics at this time. Our analytics is
            server-side and first-party.
          </li>
          <li>
            <span className="text-white font-bold">No fingerprinting.</span> Koino does not use
            browser fingerprinting techniques to track you across sessions.
          </li>
        </ul>

        {/* 9. How Users Can Manage Cookies */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          9. How Users Can Manage Cookies
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Most modern browsers let you view, block, restrict or delete cookies through their settings.
          You can usually find these options under headings such as &quot;Privacy and security&quot;,
            &quot;Cookies&quot; or &quot;Site data&quot; in your browser&apos;s settings menu. You can
          also browse Koino in a private or incognito window, which clears cookies when you close the
          window.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          If you clear Koino&apos;s cookies from your browser, you will be signed out and will need to
          sign in again. If you block all cookies on Koino, sign-in and other account features will not
          work. To balance convenience and privacy, many browsers allow you to block third-party cookies
          while still allowing first-party cookies; this configuration is generally compatible with
          Koino.
        </p>

        {/* 10. Impact of Disabling */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          10. Impact of Disabling Cookies
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Different categories of cookies and storage have different impacts when disabled:
        </p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li>
            <span className="text-white font-bold">Essential cookies disabled:</span> you will not be
            able to sign in to Koino. If you are already signed in, you will be signed out, and any
            account-only features (prayer wall, trivia, marketplace, business directory, contributor
            tools) will be unavailable.
          </li>
          <li>
            <span className="text-white font-bold">Preferences disabled:</span> the interface language
            will reset to English each time you visit, and other preference-based behaviours (such as
            dismissed banners) will not be remembered between visits. Sign-in will still work.
          </li>
          <li>
            <span className="text-white font-bold">Service worker removed:</span> Koino will no longer
            be available offline, the PWA install experience will not be available, and the app shell
            may load more slowly on repeat visits because it is no longer cached. Sign-in will still
            work over a network connection.
          </li>
          <li>
            <span className="text-white font-bold">Server-side analytics:</span> because our analytics
            is server-side, browser cookie settings do not affect it. If you do not want your activity
            to be tracked server-side, please contact us through the{" "}
            <Link href="/contact" className="text-[#A78BFA] underline">
              contact page
            </Link>{" "}
            to discuss your options.
          </li>
        </ul>

        {/* 11. Changes to This Policy */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">11. Changes to This Policy</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino may update this Cookie Policy from time to time to reflect changes in the technologies
          we use, applicable law, or our operational practices. When we make material changes, we will
          update the &quot;Last updated&quot; date at the top of this page and, where appropriate,
          notify users through the platform or our WhatsApp channel. We encourage you to review this
          policy periodically.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Your continued use of Koino after the revised Cookie Policy takes effect means you accept the
          revised policy. If you do not agree to the revised policy, you should stop using Koino and
          request account deletion through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          . If you have any questions about this Cookie Policy, you can also reach us through that page.
        </p>
      </div>
    </PublicPageLayout>
  );
}
