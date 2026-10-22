import type { Metadata } from "next";
import Link from "next/link";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Koino",
  description:
    "How Koino collects, uses, stores and protects your personal information, with awareness of India's Digital Personal Data Protection Act, 2023 (DPDP Act) and the Digital Personal Data Protection Rules, 2025.",
  openGraph: {
    title: "Privacy Policy | Koino",
    siteName: "Koino",
    type: "article",
  },
};

export default function PrivacyPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Heading */}
        <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#A09DB1] mb-6">Last updated: October 7, 2026</p>

        {/* Legal disclaimer */}
        <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-2xl p-4 mb-8">
          <p className="text-xs text-[#A09DB1] leading-relaxed">
            This document is provided for informational purposes and does not constitute legal advice.
            Have it reviewed by qualified legal counsel before relying on it. This is a draft privacy
            policy that should be reviewed and finalised by qualified legal counsel familiar with
            India&apos;s Digital Personal Data Protection Act, 2023 and the Digital Personal Data
            Protection Rules, 2025.
          </p>
        </div>

        <p className="text-sm text-[#A09DB1] leading-relaxed mb-8">
          Koino cares about your privacy. This Privacy Policy explains what personal information we
          collect when you use the Koino platform at{" "}
          <Link href="/" className="text-[#A78BFA] underline">
            https://www.koino.in
          </Link>{" "}
          and related services (the &quot;Services&quot;), how we use it, with whom we share it, how
          long we keep it, and the rights you have over it. We have drafted this policy with awareness
          of India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act) and the Digital
          Personal Data Protection Rules, 2025. This policy should be read together with our{" "}
          <Link href="/terms" className="text-[#A78BFA] underline">
            Terms of Service
          </Link>{" "}
          and our{" "}
          <Link href="/cookies" className="text-[#A78BFA] underline">
            Cookie Policy
          </Link>
          .
        </p>

        {/* 1. Who Koino Is */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">1. Who Koino Is</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino is a Christian community platform operated by Koino, with its website at
          https://www.koino.in. For the purposes of this Privacy Policy and applicable Indian data
          protection law, Koino acts as the data fiduciary (or data controller) responsible for
          determining the purposes and means of processing the personal data you provide through the
          platform. Koino is responsible for ensuring that your personal data is processed in
          accordance with this policy and applicable Indian law.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          If you have any questions about this Privacy Policy or how we handle your personal data, you
          can reach out through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          . Specific contact details for the Grievance Officer are listed in the Grievance Officer
          section below. We may update the contact information and other operational details from time
          to time; the most recent version will always be available on this page.
        </p>

        {/* 2. What Information We Collect */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          2. What Information We Collect
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We collect information that you provide directly to us and information that is collected
          automatically when you use the platform. The categories of personal data we may collect
          include the following:
        </p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li>
            <span className="text-white font-bold">Account and authentication information:</span> your
            email address and, when you sign in with Google OAuth, the name and profile photo Google
            shares with us. When you sign up with email and password, your password is stored only as a
            cryptographic hash via Supabase Auth and is never stored or transmitted in plain text.
          </li>
          <li>
            <span className="text-white font-bold">Username:</span> a username of your choice selected
            during onboarding, used to identify you publicly on Koino.
          </li>
          <li>
            <span className="text-white font-bold">Profile information:</span> date of birth, gender,
            state, city, mobile number and profile photo, where you choose to provide them.
          </li>
          <li>
            <span className="text-white font-bold">Faith journey information:</span> your preferred
            language and any denomination or tradition you choose to share during onboarding or in your
            profile.
          </li>
          <li>
            <span className="text-white font-bold">Prayer requests:</span> the content you submit to the
            Prayer Wall, including any text, images and prayer intentions you choose to share with the
            community.
          </li>
          <li>
            <span className="text-white font-bold">User-generated content:</span> blog comments,
            apologetics comments, marketplace listings, business directory listings, prayer wall posts
            and other content you create on the platform.
          </li>
          <li>
            <span className="text-white font-bold">Trivia participation:</span> your answers to Bible
            trivia questions, accumulated Faith Points, competition entries, leaderboard position and
            reward claims.
          </li>
          <li>
            <span className="text-white font-bold">Church and event interactions:</span> the churches
            and events you follow, register interest in, or interact with on the platform.
          </li>
          <li>
            <span className="text-white font-bold">Marketplace and business directory information:</span>{" "}
            product listings, business listings and contact details you choose to make visible to other
            users.
          </li>
          <li>
            <span className="text-white font-bold">Contributor information:</span> contributor
            applications, articles authored, drafts and editorial communications.
          </li>
          <li>
            <span className="text-white font-bold">Contact form submissions:</span> the name, email,
            phone number, subject and message you provide when you contact us through the{" "}
            <Link href="/contact" className="text-[#A78BFA] underline">
              contact page
            </Link>
            .
          </li>
          <li>
            <span className="text-white font-bold">Usage and device information:</span> basic
            server-side event data such as pages viewed, features used, approximate location inferred
            from IP address, device type and browser, as further described in the Analytics section.
          </li>
        </ul>

        {/* 3. Authentication — Google OAuth */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          3. Authentication — Google OAuth
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino offers Google OAuth as one of the sign-in options. When you choose to sign in with
          Google, Google shares with Koino the name, email address and profile photo associated with
          your Google account. Google may also share a stable identifier that allows us to recognise the
          same account across sessions. Koino uses this information to create and authenticate your
          account and to display your name and profile photo on the platform.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We do not request, and Google does not share with us, your Google password. The authentication
          flow happens on Google&apos;s domain, and Google&apos;s own privacy policy and terms apply to
          that part of the process. You can review or revoke Koino&apos;s access to your Google account
          at any time through your Google account settings. If you revoke access, you may continue to
          sign in to Koino using email and password, but Google-provided profile information may no
          longer sync automatically.
        </p>

        {/* 4. Cookies & Local Storage */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">4. Cookies &amp; Local Storage</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino uses cookies and browser local storage to keep you signed in, remember your preferences
          (such as your preferred language), and provide core functionality. The most important cookies
          are the Supabase Auth session cookies, which are necessary for you to remain logged in as you
          navigate the platform. Without these essential cookies, the sign-in feature will not work.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino does not use third-party advertising cookies, third-party tracking pixels or social
          media tracking cookies. More detail about the specific cookies and local storage items we use,
          the purposes for which we use them, and the choices you have is available in our{" "}
          <Link href="/cookies" className="text-[#A78BFA] underline">
            Cookie Policy
          </Link>
          .
        </p>

        {/* 5. Analytics */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">5. Analytics</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino uses basic server-side event tracking to understand how the platform is used and to
          improve it. When you perform certain actions on Koino, the platform may send a small event
          payload to our own endpoint at <code className="text-[#A78BFA]">/api/track</code>. This payload
          typically includes the type of event, the page or feature involved, your user identifier (when
          signed in) and basic request metadata such as timestamp. This tracking happens server-side,
          which means it does not rely on third-party analytics cookies.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We do not use third-party analytics services such as Google Analytics on Koino at this time.
          We do not build advertising profiles of you, and we do not sell or share your personal data for
          advertising purposes. We may, in the future, introduce additional analytics tools; if we do so,
          we will update this Privacy Policy and our Cookie Policy to reflect the change, and we will
          honour the consent choices available at that time under applicable Indian law.
        </p>

        {/* 6. How We Use Your Information */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          6. How We Use Your Information
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We use the information we collect for the following purposes:
        </p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li>
            To provide, operate and maintain the Services, including authentication, profile
            management, prayer wall, trivia, churches, events, marketplace and business directory
            features.
          </li>
          <li>
            To create and manage your account, including verifying your email address, authenticating
            your sign-in attempts and keeping you signed in across page loads.
          </li>
          <li>
            To communicate with you about your account, security alerts, important platform updates,
            responses to your enquiries and (where you have opted in) community and devotional updates.
          </li>
          <li>
            To moderate content and conduct on the platform, investigate reports, enforce our Terms of
            Service and protect members from harmful activity.
          </li>
          <li>
            To improve the platform, understand which features are used, fix bugs, plan new features
            and provide a better experience for the community.
          </li>
          <li>
            To comply with applicable legal obligations and to protect the rights, property and safety
            of Koino, our members and others.
          </li>
        </ul>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We process your personal data on the lawful bases of consent (where you have provided it),
          performance of a contract (providing the Services you requested), compliance with legal
          obligations and our legitimate interests in operating and protecting the platform. Where
          processing is based on consent, you may withdraw consent at any time without affecting the
          lawfulness of processing carried out before withdrawal.
        </p>

        {/* 7. Service Providers */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">7. Service Providers</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino uses third-party service providers to deliver the Services. Each provider is a separate
          data controller or processor with its own privacy policy that governs how they handle personal
          data. We use the following key providers:
        </p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li>
            <span className="text-white font-bold">Supabase:</span> provides authentication (Supabase
            Auth), the PostgreSQL database that stores most Koino data, and Supabase Storage for images
            such as profile photos, prayer wall images and listing images. Supabase may process personal
            data on our behalf as a data processor under its terms of service and privacy policy.
          </li>
          <li>
            <span className="text-white font-bold">Vercel:</span> hosts the Koino website and
            serverless functions. Vercel processes request metadata such as IP address, user agent and
            request timing as part of delivering the platform to your browser. Vercel acts under its own
            privacy policy and data processing terms.
          </li>
          <li>
            <span className="text-white font-bold">Google:</span> provides the Google OAuth sign-in
            option. When you use it, Google shares your name, email and profile photo with Koino. Your
            interactions with Google during sign-in are governed by Google&apos;s privacy policy.
          </li>
        </ul>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We do not sell your personal data to any third party, and we do not share your personal data
          with service providers for their own independent commercial purposes. Where a service provider
          processes personal data on our behalf, we share only the data necessary to provide the
          applicable feature, and we expect our providers to handle that data in accordance with
          applicable data protection laws.
        </p>

        {/* 8. Data Storage */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">8. Data Storage</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Your account data, profile information, prayer requests, user-generated content, trivia
          participation and other structured records are stored in a Supabase PostgreSQL database. Images
          such as profile photos, prayer wall images, listing images and comic artwork are stored in
          Supabase Storage. Authentication credentials, including password hashes and OAuth tokens, are
          managed by Supabase Auth.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Supabase and Vercel may store or process data on servers located outside India. We rely on
          Supabase&apos;s and Vercel&apos;s compliance with applicable data protection laws, including
          their standard contractual and technical safeguards for cross-border data transfers. We take
          reasonable steps to ensure that any transfer of personal data outside India is carried out in
          accordance with applicable Indian law, including the DPDP Act, 2023, where applicable to our
          processing activities.
        </p>

        {/* 9. Data Retention */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">9. Data Retention</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We keep your personal data for as long as your account is active or as long as we need it to
          provide the Services to you and to other members. Prayer requests, comments, listings and other
          user-generated content will generally remain visible on Koino for as long as your account is
          active, unless you delete the content or we remove it under our Terms of Service.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          When you request account deletion, we will remove or anonymise your personal data from active
          systems within a reasonable period, typically within 30 days. Some information may be retained
          for longer where we are required to do so by applicable law, where it is necessary to establish,
          exercise or defend legal claims, or where it is needed to complete moderation, fraud prevention
          or backup activities. Backup copies may persist for an additional period until they are
          overwritten in the normal course of our backup cycles.
        </p>

        {/* 10. External Links */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">10. External Links</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino contains links to external platforms and services that we do not control. These include
          Lordsbook (https://www.lordsbook.com), which is a separate external Christian community
          platform, and a WhatsApp channel used for community updates. When you follow such a link or
          tap such a button, you leave Koino and the privacy practices of the destination platform apply.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino is not responsible for the content, privacy practices or conduct of these external
          platforms. We encourage you to review the privacy policy of any external platform before
          signing up, sharing personal information or making a transaction there. Koino does not share
          your Koino account data with these platforms merely because you click a link; any data shared
          with an external platform is data you choose to provide there.
        </p>

        {/* 11. Lordsbook External Community */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          11. Lordsbook External Community
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino may display a &quot;Meet Christians on Lordsbook&quot; call-to-action that links to the
          Lordsbook platform at https://www.lordsbook.com. Lordsbook is a separate, independently
          operated Christian community platform. When you click that button, you leave Koino and are
          subject to Lordsbook&apos;s own terms of service and privacy policy. Koino is not responsible
          for how Lordsbook collects, uses or discloses your information.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino does NOT share your Koino account data (such as your email, password, profile
          information or activity) with Lordsbook. Any information that Lordsbook collects about you
          during your visit to its platform is governed by Lordsbook&apos;s privacy practices. If you
          create a Lordsbook account, you do so independently of your Koino account, and the two
          accounts are not linked unless you separately choose to link them through Lordsbook&apos;s own
          features.
        </p>

        {/* 12. User Rights */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          12. User Rights (under the DPDP Act, 2023)
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Under India&apos;s Digital Personal Data Protection Act, 2023, you have certain rights with
          respect to your personal data, subject to applicable conditions and exceptions in the Act and
          the Digital Personal Data Protection Rules, 2025. Subject to those conditions, you may have
          the following rights with respect to your personal data held by Koino:
        </p>
        <ul className="text-sm text-[#A09DB1] space-y-2 list-disc pl-5 mb-4">
          <li>
            <span className="text-white font-bold">Access:</span> the right to obtain information about
            the personal data we process about you and a summary of how it is processed.
          </li>
          <li>
            <span className="text-white font-bold">Correction and updating:</span> the right to correct,
            update or complete inaccurate or incomplete personal data.
          </li>
          <li>
            <span className="text-white font-bold">Erasure:</span> the right to request erasure of your
            personal data, subject to applicable exceptions (for example, where retention is required by
            law).
          </li>
          <li>
            <span className="text-white font-bold">Withdrawal of consent:</span> where processing is
            based on your consent, the right to withdraw that consent at any time, without affecting the
            lawfulness of processing carried out before withdrawal.
          </li>
          <li>
            <span className="text-white font-bold">Grievance redressal:</span> the right to raise a
            grievance with Koino about how your personal data is processed, and to receive a response
            within the timelines prescribed by applicable law.
          </li>
          <li>
            <span className="text-white font-bold">Nomination:</span> the right, where applicable under
            the DPDP Act and Rules, to nominate another individual to exercise your rights in the event
            of your death or incapacity.
          </li>
        </ul>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          To exercise any of these rights, please contact us through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>{" "}
          or write to the Grievance Officer listed below. We will respond to your request within the
          timeframes prescribed by applicable law. We may need to verify your identity before processing
          your request, and we may decline or limit a request where permitted or required by law.
        </p>

        {/* 13. Children & Minors */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">13. Children &amp; Minors</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino is not directed at children under 13, and we do not knowingly collect personal
          information from children under 13. Under the DPDP Act, 2023, processing of personal data of
          a child (generally under 18) requires verifiable parental consent, and we ask that parents and
          guardians exercise appropriate supervision over a minor&apos;s use of Koino. Users between 13
          and 18 may use Koino only with the involvement and consent of a parent or legal guardian, as
          described in our Terms of Service.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We do not carry out behavioural tracking or targeted advertising directed at minors. If we
          become aware that we have collected personal data from a child under 13 without verifiable
          parental consent, we will take steps to delete that data as soon as practicable. If you are a
          parent or guardian and you believe your child has provided us with personal data, please
          contact us through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          .
        </p>

        {/* 14. Security */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">14. Security</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino takes reasonable technical and organisational measures to protect your personal data
          against unauthorised access, loss, misuse or alteration. These measures include storing
          passwords only as cryptographic hashes via Supabase Auth (never in plain text), using HTTPS
          for data in transit, restricting administrative access to authorised personnel, and using
          secure authentication cookies for session management.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          No system can be 100% secure. We cannot guarantee that unauthorised access, hacking, data loss
          or other breaches will never occur. In the event of a personal data breach that is likely to
          cause harm to you, we will take reasonable steps to notify affected users and the relevant
          authorities as required by applicable Indian law, including the DPDP Act, 2023 and the
          Digital Personal Data Protection Rules, 2025, where they apply. If you have reason to believe
          your account has been compromised, please contact us immediately.
        </p>

        {/* 15. Changes to This Privacy Policy */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          15. Changes to This Privacy Policy
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We may update this Privacy Policy from time to time to reflect changes in our practices,
          legal obligations, feature availability, or feedback from the community and legal counsel.
          When we make material changes, we will update the &quot;Last updated&quot; date at the top of
          this page and, where appropriate, notify users through the platform or our WhatsApp channel.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We encourage you to review this Privacy Policy periodically. Your continued use of Koino
          after the revised Privacy Policy takes effect means you accept the revised policy. If you do
          not agree to the revised policy, you should stop using Koino and request account deletion
          through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          .
        </p>

        {/* 16. Grievance Officer */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">16. Grievance Officer</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Under the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection
          Rules, 2025, every data fiduciary is required to designate a Grievance Officer to handle
          grievances related to personal data processing. Koino is in the process of formally
          designating a Grievance Officer. Until the formal designation and contact details are
          published here, grievances may be raised through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>{" "}
          with the subject &quot;Privacy Grievance&quot;.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          <span className="text-white font-bold">Grievance Officer:</span> [To be configured] — contact
          via the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          . We aim to acknowledge grievances within the timeframe prescribed by applicable law and to
          resolve them within a reasonable period. This section will be updated with the name and
          contact details of the designated Grievance Officer as soon as that designation is finalised.
        </p>

        {/* 17. Contact */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">17. Contact</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          If you have any questions, requests or concerns about this Privacy Policy or about how we
          handle your personal data, please contact us through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          . You can also use that page to exercise your data protection rights, request account deletion
          or report a privacy concern. We aim to respond to legitimate enquiries within a reasonable
          time, typically within a few working days.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          By using Koino, you acknowledge that you have read and understood this Privacy Policy. This
          policy does not override any rights you may have under applicable Indian law. If any part of
          this policy is found to be unenforceable by a court of competent jurisdiction, the remaining
          parts will remain in full force and effect.
        </p>
      </div>
    </PublicPageLayout>
  );
}
