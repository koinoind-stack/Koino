import type { Metadata } from "next";
import Link from "next/link";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service | Koino",
  description:
    "The terms that govern your use of Koino, a Christian community platform at https://www.koino.in. By creating an account or using any Koino feature, you agree to these terms.",
  openGraph: {
    title: "Terms of Service | Koino",
    siteName: "Koino",
    type: "article",
  },
};

export default function TermsPage() {
  return (
    <PublicPageLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Heading */}
        <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-[#A09DB1] mb-6">Last updated: October 7, 2026</p>

        {/* Legal disclaimer */}
        <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-2xl p-4 mb-8">
          <p className="text-xs text-[#A09DB1] leading-relaxed">
            This document is provided for informational purposes and does not constitute legal advice.
            Have it reviewed by qualified legal counsel before relying on it.
          </p>
        </div>

        <p className="text-sm text-[#A09DB1] leading-relaxed mb-8">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Koino
          platform, including the website at{" "}
          <Link href="/" className="text-[#A78BFA] underline">
            https://www.koino.in
          </Link>{" "}
          and any related services, features, content and applications we offer (together, the
          &quot;Services&quot;). The Services are operated by Koino (&quot;Koino&quot;,
          &quot;we&quot;, &quot;us&quot; or &quot;our&quot;). By creating an account, signing in, or
          using any part of the Services, you agree to be bound by these Terms. If you do not agree
          with any part of these Terms, you must not access or use the Services. These Terms apply to
          all users, including general community members, churches, businesses, contributors and
          anyone who interacts with Koino content.
        </p>

        {/* 1. Acceptance of Terms */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">1. Acceptance of Terms</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          By accessing or using Koino, you confirm that you have read, understood and agree to these
          Terms and to any other policies we reference, including our Privacy Policy and Cookie
          Policy. If you are using Koino on behalf of an organisation, church or business, you confirm
          that you have the authority to bind that entity to these Terms, and in that case
          &quot;you&quot; refers to both you and that entity. We may update these Terms from time to
          time, and the most current version will always be available on this page with the updated
          &quot;Last updated&quot; date. Your continued use of Koino after any change takes effect
          means you accept the revised Terms. If you do not agree to the revised Terms, you should
          stop using Koino and request account deletion as described in our Privacy Policy.
        </p>

        {/* 2. Eligibility */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">2. Eligibility</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          You must be at least 13 years old to create a Koino account or to use any feature that
          requires sign-in. Users between the ages of 13 and 18 (&quot;minors&quot;) may use Koino
          only with the involvement, knowledge and consent of a parent or legal guardian. By
          allowing a minor in your care to use Koino, you accept these Terms on their behalf and
          accept responsibility for their activity on the platform. Koino is not directed at children
          under 13, and we do not knowingly collect personal information from children under 13 as
          described in our Privacy Policy. If you believe a child under 13 has registered an account,
          please contact us through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>{" "}
          so we can remove the account. Some features of Koino, such as the marketplace and business
          directory, may involve interactions with third parties; in those cases additional age or
          identity requirements under applicable Indian law may apply.
        </p>

        {/* 3. Accounts */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">3. Accounts</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          To access most Koino features you need to create an account. You can sign up either by
          using Google OAuth (which shares your name, email address and profile photo with Koino) or
          by registering with an email address and password of your choice. When you choose the
          email and password option, your password is stored only as a cryptographic hash through
          Supabase Auth and is never stored in plain text. During onboarding, you will choose a
          username and may provide additional profile information such as your date of birth, gender,
          state, city, mobile number and profile photo.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          You are responsible for keeping your password and account credentials confidential and for
          all activity that happens under your account. You agree to notify us immediately if you
          suspect any unauthorised use of your account or any other security breach. We may suspend
          or close an account if we believe it has been compromised, used in violation of these Terms,
          or used in a way that harms other users or the platform. You may request deletion of your
          account at any time through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          , subject to our retention obligations described in the Privacy Policy.
        </p>

        {/* 4. User Responsibilities */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">4. User Responsibilities</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          You agree to use Koino only for lawful purposes and in a way that does not infringe the
          rights of others or restrict their use of the platform. You are responsible for the accuracy
          of the information you provide and for any content you post, including prayer requests,
          comments, marketplace listings, business directory entries and messages to other users. You
          must not impersonate another person, organisation, church or business, and you must not
          create accounts under false or misleading pretences.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          You agree not to misuse the platform, including by attempting to gain unauthorised access to
          our systems, reverse-engineering or scraping content, interfering with the proper functioning
          of Koino, attempting to manipulate Faith Points or trivia competitions, or attempting to
          bypass moderation or rate limits. You are responsible for any device, internet connection
          and charges you incur while using Koino. Koino is provided on a reasonable-efforts basis and
          we cannot guarantee that every feature will be available at all times.
        </p>

        {/* 5. Christian Community Conduct */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">5. Christian Community Conduct</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino is a Christian community platform and we ask all members to engage with kindness,
          respect and grace. You agree not to post, share or encourage any content that constitutes
          hate speech, harassment, bullying, threats, discrimination on the basis of religion, caste,
          gender, ethnicity, nationality or any other protected characteristic, or content that attacks
          or demeans other Christian denominations or traditions present within the broader Christian
          community. Disagreement is welcome when expressed respectfully; personal attacks are not.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          You also agree not to use Koino to promote teaching that the wider Christian community would
          reasonably consider false, deliberately misleading, or that exploits vulnerable members.
          Prohibited conduct includes spamming, unsolicited advertising, chain messages, repetitive
          posting, attempts to manipulate the prayer wall or trivia leaderboards, and any activity that
          could harm the spiritual, emotional or physical well-being of other members. Koino reserves
          the right to remove content and take action against accounts that violate these standards, as
          described in the Moderation section below.
        </p>

        {/* 6. User-Generated Content */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">6. User-Generated Content</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino allows users to create and publish various kinds of content, including prayer
          requests on the Prayer Wall, comments on blog articles and apologetics posts, marketplace
          product listings, business directory entries, prayer wall posts, and entries in churches and
          events listings. You retain ownership of the content you create, but you grant Koino a
          worldwide, non-exclusive, royalty-free licence to host, store, reproduce, display and use
          that content for the purpose of operating, improving and promoting the Services, as further
          described in the Intellectual Property section.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          You are solely responsible for the content you post and you represent that you have all
          necessary rights to post it. You must not post content that is unlawful, defamatory,
          infringing, sexually explicit, violent, deceptive, or that violates the privacy of others
          (including sharing personal contact details of third parties without their consent). Koino
          does not endorse every piece of user content and is not responsible for the accuracy of
          listings, claims, prices or teachings made by users. We may remove any content that
          violates these Terms or that we believe is harmful to the community.
        </p>

        {/* 7. Bible & Educational Content Disclaimer */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          7. Bible &amp; Educational Content Disclaimer
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino provides Bible text, Bible reading plans, Bible Comics, apologetics articles, Bible
          trivia questions and other educational content for the purpose of helping members read,
          understand and engage with Scripture. This content is offered for personal study and
          encouragement and is not a substitute for pastoral counsel, professional therapy, legal
          advice, medical advice or formal theological training. Bible translations referenced on
          Koino, including the King James Version (KJV) and the World English Bible (WEB), are public
          domain or used in accordance with their applicable licences.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Interpretation of Scripture is a deeply personal and tradition-sensitive matter. Different
          Christian denominations and traditions may interpret passages differently, and Koino&apos;s
          educational content should be read with that awareness. If you are facing a serious life
          situation, mental health crisis or doctrinal question, please seek guidance from a trusted
          pastor, counsellor or qualified professional in your local community. Koino is an
          educational platform and does not provide pastoral care, counselling or doctrinal rulings.
        </p>

        {/* 8. Bible Trivia, Faith Points & Competitions */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          8. Bible Trivia, Faith Points &amp; Competitions
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino offers Bible trivia quizzes, daily challenges and timed competitions that allow
          members to test their Bible knowledge and earn Faith Points. Faith Points are an internal
          recognition metric only; they have no monetary value, cannot be exchanged for cash, cannot
          be transferred between accounts, and may be reset, adjusted or removed at Koino&apos;s
          discretion in cases of suspected manipulation, farming or violation of these Terms.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          From time to time, Koino may run competitions that offer real-world prizes, gifts or
          rewards to participants. Such competitions may be subject to additional eligibility rules,
          geographic restrictions, verification of identity, and admin review before prizes are
          released. Koino reserves the right to disqualify any participant suspected of cheating,
          using multiple accounts, automating answers or otherwise gaining unfair advantage. Prizes
          are offered subject to availability, and Koino may substitute a prize of similar value if
          necessary. Where a prize requires shipping, the winner is responsible for providing
          accurate shipping details and for any taxes, duties or charges that may apply.
        </p>

        {/* 9. Churches & Events */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">9. Churches &amp; Events</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino lists churches and Christian events to help members discover communities and
          gatherings across India. A listing on Koino does not constitute an endorsement by Koino of
          any particular church, ministry, doctrine, leader or event. Information about churches and
          events, including service timings, addresses, contact details and descriptions, is provided
          by the church or event organiser, and Koino is not responsible for its accuracy or for any
          changes that occur after listing.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          When you follow a church or register interest in an event, the information you provide may be
          shared with the listed church or event organiser so they can communicate with you. Koino is
          not a party to any relationship that forms between you and a church or event organiser, and
          is not responsible for the conduct of those third parties. Members should exercise normal
          discernment and caution before attending an unfamiliar church or event, sharing personal
          information, or making any donation to a third party.
        </p>

        {/* 10. Marketplace & Business Directory */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          10. Marketplace &amp; Business Directory
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino hosts a marketplace where members can list products, and a business directory where
          Christian businesses can be discovered. Koino provides the listing infrastructure only and
          does NOT process payments for products, services or business transactions. Any purchase, sale
          or commercial arrangement is made directly between you and the seller, buyer or business
          listed on Koino. Koino is not a party to those transactions and is not responsible for the
          quality, safety, legality, delivery or condition of any product or service offered by a third
          party.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          By using the marketplace or business directory, you accept that any transaction you enter
          into is solely between you and the other party. You should exercise normal caution before
          paying for a product, sharing payment details or meeting a stranger in person. Koino may
          remove listings that are misleading, unlawful, infringing, or that violate these Terms. Any
          disputes regarding transactions should be resolved directly between the parties involved;
          Koino may, at its discretion and upon request, assist with moderation but has no obligation
          to mediate or refund. Online payment processing is not currently connected on Koino; any UPI,
          QR code or bank transfer information shown on a listing is provided by the seller or business
          for informational purposes only and is not processed by Koino.
        </p>

        {/* 11. Contributor Content */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">11. Contributor Content</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino allows approved contributors to publish articles, blog posts, apologetics content and
          other material. Contributors are granted publishing permissions by Koino administrators after
          a basic application and review process. Contributors are expected to write honestly, cite
          sources where appropriate, respect copyright, and uphold the Christian community conduct
          standards described in these Terms. Contributors remain responsible for the accuracy and
          originality of their work.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino performs a light editorial review of contributor content before publication, but does
          not endorse every theological statement, interpretation or opinion expressed. Readers are
          encouraged to compare any teaching with Scripture and to consult their own church leaders on
          doctrinal questions. Koino may unpublish, edit or remove contributor content that violates
          these Terms, that is reported by the community, or that is found to be inaccurate or harmful
          after publication. Contributors do not receive monetary compensation unless a separate written
          agreement is in place.
        </p>

        {/* 12. Intellectual Property */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">12. Intellectual Property</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          The Koino name, logo, branding, website design, original illustrations (including Bible
          Comics), Bible trivia questions authored by Koino, articles authored by Koino, software code
          and platform features are owned by Koino or its licensors and are protected by Indian and
          international intellectual property laws. You may not copy, modify, distribute, sell or
          create derivative works from Koino-owned content without our prior written permission, except
          for personal, non-commercial use as permitted by applicable law.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          With respect to content that you create and publish on Koino, you retain ownership of that
          content. However, by posting it on Koino, you grant Koino a worldwide, non-exclusive,
          royalty-free, sublicensable licence to host, store, reproduce, adapt, display, distribute and
          otherwise use that content for the purpose of operating, improving, securing and promoting
          the Services. This licence continues for as long as your content remains on Koino and
          terminates, on a going-forward basis, when you delete the content or your account, except
          where we are required to retain copies for legal, moderation or backup purposes described in
          our Privacy Policy.
        </p>

        {/* 13. External Links */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">13. External Links</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino may contain links to external websites and services that we do not control, including
          Lordsbook (https://www.lordsbook.com), which is a separate external Christian community
          platform. When you follow an external link, you leave Koino and are subject to the terms,
          privacy policy and practices of that external platform. Koino is not responsible for the
          content, accuracy, conduct or services of any external site, and the inclusion of a link
          does not imply endorsement.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino also shares information such as a WhatsApp channel link for community updates. Koino
          does not share your account data with these external platforms. You should review the terms
          and privacy policy of any external service before signing up or sharing personal information
          there. Any interactions you have with external platforms are entirely between you and that
          platform, and Koino is not liable for any loss, damage or dispute arising from those
          interactions.
        </p>

        {/* 14. Donations & Support */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">14. Donations &amp; Support</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino is free to use. From time to time we may invite voluntary financial support from the
          community to help cover technology, hosting, Bible content, trivia prizes and community
          development costs. Any contribution you choose to make is entirely voluntary and does not
          create any contractual obligation on Koino to provide specific content, features or rewards
          in return, except where a specific written agreement or a competition prize structure states
          otherwise.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Online payment processing is not yet connected on Koino. Until a payment provider is
          configured, any UPI handle, QR code or bank account information shown on the platform is
          provided for informational purposes only and is not processed through Koino. Koino is not
          responsible for payments made directly to third-party accounts. Once a payment provider is
          integrated, additional terms specific to that provider may apply, and we will update this
          section accordingly. If you would like to support Koino, please reach out through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          .
        </p>

        {/* 15. Moderation */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">15. Moderation</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino may moderate user-generated content and contributor content to keep the community safe
          and welcoming. Moderation may be carried out proactively, in response to user reports, or
          through automated checks. We may remove, hide or restrict content that violates these Terms,
          that is reported by the community as harmful, or that we believe is harmful to members or to
          the platform. Moderation actions may include editing, unpublishing, demoting, labelling or
          removing content, and may also include temporary or permanent restrictions on accounts.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We aim to apply moderation fairly, but Koino reserves the sole and final discretion to decide
          what content and conduct are acceptable on the platform. We are not obligated to provide
          detailed reasons for every moderation decision, though we will try to communicate clearly when
          action is taken. You can report concerning content through the in-platform report mechanisms
          or by contacting us through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          .
        </p>

        {/* 16. Suspension & Blocking */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">16. Suspension &amp; Blocking</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino may suspend, restrict, block or terminate any account at any time if we believe that the
          account has violated these Terms, has been used for unlawful or harmful activity, has
          attempted to manipulate Faith Points or trivia competitions, has been reported repeatedly by
          other members, or otherwise poses a risk to the community or to Koino. We may also block email
          addresses, IP addresses, devices or other identifiers associated with abusive activity.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Where appropriate, we will attempt to provide notice and an opportunity to respond before
          taking serious action, but Koino may act immediately without prior notice where we believe it
          is necessary to protect members, the platform or third parties. Upon termination, your right to
          use Koino ends, and we may delete your content and account data subject to our retention
          obligations. You may also close your account at any time by contacting us. These Terms will
          continue to apply to your past use of Koino even after your account is closed.
        </p>

        {/* 17. Availability */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">17. Availability</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino is provided on an &quot;as available&quot; basis. We do not warrant that the Services
          will be uninterrupted, error-free, secure or available at all times. The platform may
          experience downtime, delays, bugs, maintenance windows, feature changes or outages due to
          hosting issues, third-party service provider issues (such as Supabase, Vercel or Google),
          network problems, attacks, force majeure events or other causes beyond our control. We may
          modify, suspend or discontinue any feature, content or part of the Services at any time
          without prior notice.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          We will use reasonable efforts to restore service promptly after any outage, but we are not
          liable for any loss, damage or inconvenience arising from platform unavailability. Where
          possible, we will communicate known major outages through our WhatsApp channel or other
          official channels. Continued use of Koino after a service change constitutes acceptance of the
          updated availability.
        </p>

        {/* 18. Disclaimer of Warranties */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">18. Disclaimer of Warranties</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino and all content, listings and features available through it are provided &quot;as
          is&quot; and &quot;as available&quot; without warranties of any kind, whether express or
          implied, to the maximum extent permitted by applicable law. We do not warrant that the platform
          will be accurate, reliable, complete, secure, error-free or fit for any particular purpose, or
          that defects will be corrected. Any content accessed or relied upon through Koino is done at
          your own risk.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino does not warrant the truthfulness, accuracy, doctrinal soundness or completeness of
          user-generated content, contributor content, marketplace listings, business directory listings,
          church listings or event details. Advice, teachings or information obtained through Koino should
          not be relied upon without independent verification. No advice or information, whether oral or
          written, obtained from Koino or through the Services, creates any warranty not expressly stated
          in these Terms. Applicable law may not allow the exclusion of certain warranties, in which case
          those exclusions apply only to the extent permitted.
        </p>

        {/* 19. Limitation of Liability */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">19. Limitation of Liability</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          To the maximum extent permitted by applicable law, in no event shall Koino, its operators,
          volunteers, contributors, partners or service providers be liable for any indirect, incidental,
          special, consequential, exemplary or punitive damages, including but not limited to loss of
          data, profits, faith, goodwill, reputation or other intangible losses, arising out of or
          related to your use of, or inability to use, the Services. This includes any losses arising
          from transactions with other users on the marketplace or business directory, interactions with
          listed churches or events, reliance on Bible or educational content, or participation in trivia
          competitions.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          The total aggregate liability of Koino for any claim arising out of or relating to these
          Terms or the Services, regardless of the form of action, shall not exceed the greater of (a)
          the amount you have paid to Koino in connection with the Services in the twelve months
          preceding the claim, or (b) one thousand Indian rupees (INR 1,000). These limitations apply
          even if Koino has been advised of the possibility of such damages. Nothing in these Terms
          excludes or limits liability that cannot be excluded or limited under applicable Indian law,
          such as liability for gross negligence or wilful misconduct to the extent mandated by law.
        </p>

        {/* 20. Changes to Terms */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">20. Changes to Terms</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Koino may update these Terms from time to time to reflect changes in the platform, applicable
          law, community feedback, or our operational practices. When we make material changes, we will
          update the &quot;Last updated&quot; date at the top of this page and, where appropriate, notify
          users through the platform or our WhatsApp channel. We encourage you to review these Terms
          periodically.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Your continued use of Koino after the revised Terms take effect constitutes your acceptance of
          the revised Terms. If you do not agree to the revised Terms, you must stop using Koino and
          request account deletion through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          . The prior version of the Terms will continue to govern any dispute that arose before the
          revised Terms took effect, to the extent permitted by law.
        </p>

        {/* 21. Governing Law & Jurisdiction */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">
          21. Governing Law &amp; Jurisdiction
        </h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          These Terms and any dispute arising out of or in connection with them or your use of Koino
          shall be governed by and construed in accordance with the laws of the Republic of India,
          without giving effect to any conflict of laws principles. For the avoidance of doubt, this
          includes the Information Technology Act, 2000 and the rules made thereunder, the Digital
          Personal Data Protection Act, 2023 (where applicable to personal data processing), and other
          applicable Indian laws.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          Subject to any mandatory consumer dispute resolution provisions under Indian law, the courts
          at Hyderabad, Telangana, India shall have exclusive jurisdiction over any disputes, claims or
          proceedings arising out of or relating to these Terms or your use of Koino. You and Koino
          agree that any such proceedings will be conducted in the English language. We may, at our
          discretion, attempt to resolve disputes informally before initiating formal proceedings, and
          you are encouraged to reach out through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>{" "}
          first.
        </p>

        {/* 22. Contact */}
        <h2 className="text-base font-bold text-white mt-8 mb-3">22. Contact</h2>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          If you have any questions, concerns, reports or notices regarding these Terms or your use of
          Koino, please contact us through the{" "}
          <Link href="/contact" className="text-[#A78BFA] underline">
            contact page
          </Link>
          . For grievance redressal related to personal data, please refer to the Grievance Officer
          section in our Privacy Policy. We aim to respond to legitimate enquiries within a reasonable
          time, typically within a few working days.
        </p>
        <p className="text-sm text-[#A09DB1] leading-relaxed mb-4">
          By using Koino, you acknowledge that you have read and understood these Terms, that you have
          had the opportunity to seek independent legal advice if you wished, and that you agree to be
          bound by them. If any part of these Terms is found to be unenforceable by a court of competent
          jurisdiction, the remaining parts will remain in full force and effect.
        </p>
      </div>
    </PublicPageLayout>
  );
}
