import type { Metadata } from "next";
import PublicPageLayout from "@/components/crosscrafted/PublicPageLayout";
import { Sparkles, Heart, Users, BookOpen, Trophy, Store, Languages, MapPin, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "About Koino — Faith. Fellowship. Belong.",
  description:
    "Koino is a Christian community platform inspired by the Greek word koinonia — fellowship, communion, partnership, and shared participation among believers. Built with India in mind.",
  openGraph: {
    title: "About Koino — Faith. Fellowship. Belong.",
    description: "Koino is an all-in-one Christian community platform inspired by koinonia.",
    siteName: "Koino",
    type: "website",
  },
};

const PILLARS = [
  { icon: BookOpen, title: "Faith", desc: "Read the Bible, explore Bible Comics, and grow in your understanding of Scripture." },
  { icon: Heart, title: "Fellowship", desc: "Connect with churches, discover Christian events, and pray together as a community." },
  { icon: Users, title: "Belong", desc: "Find your place in the Christian community — churches, groups, businesses and more." },
];

const FEATURES = [
  { icon: BookOpen, title: "Holy Bible", desc: "Read all 66 books in KJV and WEB. Search, bookmark, and follow reading plans." },
  { icon: Sparkles, title: "Bible Comics", desc: "Experience Bible stories through original visual storytelling." },
  { icon: Users, title: "Churches", desc: "Discover Christian churches by state, city, and language across India." },
  { icon: Trophy, title: "Bible Trivia", desc: "Test your Bible knowledge, earn Faith Points, and win real prizes in competitions." },
  { icon: Heart, title: "Prayer Wall", desc: "Share prayer requests and pray for others in the community." },
  { icon: Store, title: "Marketplace & Business Directory", desc: "Discover Christian products and businesses across India." },
];

const SUPPORTED_LANGUAGES = [
  "English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil",
  "Gujarati", "Urdu", "Kannada", "Oriya", "Malayalam", "Punjabi", "Assamese",
];

export default function AboutPage() {
  return (
    <PublicPageLayout>
      {/* Hero */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-6">
          <Sparkles size={12} fill="currentColor" /> About Koino
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          An all-in-one Christian{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F39B9B] to-[#9786E3]">
            community platform
          </span>
        </h1>
        <p className="text-base text-[#A09DB1] leading-relaxed max-w-2xl mx-auto mb-8">
          Koino is inspired by the Greek word &quot;koinonia&quot; — fellowship, communion, partnership
          and shared participation among believers. We bring Scripture, fellowship, churches, events,
          prayer, Bible learning, Christian businesses and community experiences together in one place.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="/" className="px-8 py-3.5 bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all hover:-translate-y-px">
            Enter Koino
          </a>
          <a href="/about/founder" className="px-8 py-3.5 border border-white/[0.08] hover:border-white/[0.15] text-[#A09DB1] hover:text-white font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all bg-white/[0.02]">
            Meet the Founder
          </a>
        </div>
      </section>

      {/* The Meaning of Koino */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA] text-[10px] font-bold uppercase tracking-wider mb-3">
            <BookOpen size={11} /> The Meaning of Koino
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">The Meaning of Koino</h2>
          <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto leading-relaxed">
            The name Koino comes from the Greek word <span className="text-white font-semibold">&quot;koinonia&quot;</span> (κοινωνία) —
            a word used throughout the New Testament to describe the deep, shared life of the early church.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 text-sm text-[#A09DB1] leading-relaxed">
            <p>
              Koinonia is one of the richest words in the New Testament. It is most commonly translated as
              <span className="text-white font-semibold"> fellowship</span>, but it carries far more weight than
              the English word suggests. It speaks of <span className="text-white font-semibold">communion</span>,
              <span className="text-white font-semibold"> partnership</span>,
              <span className="text-white font-semibold"> joint participation</span>, and the daily reality of
              <span className="text-white font-semibold"> sharing life together</span> as believers. When the
              early Christians gathered, they did not merely meet — they shared their hearts, their resources,
              their meals, their prayers, and their very lives.
            </p>
            <p>
              This word appears throughout the New Testament. In <span className="text-white font-semibold">Acts 2:42</span>,
              the first believers &quot;devoted themselves to the apostles&apos; teaching and to fellowship, to the
              breaking of bread and to prayer.&quot; In <span className="text-white font-semibold">Philippians 2:1</span>,
              Paul urges the church to be united through &quot;fellowship with the Spirit.&quot; In
              <span className="text-white font-semibold"> 1 John 1:3–7</span>, the apostle John writes that our
              fellowship is not only with one another but also with the Father and with His Son, Jesus Christ.
              Koinonia is therefore both horizontal (between believers) and vertical (between us and God).
            </p>
            <p>
              Christian fellowship is far more than casual social interaction. It involves sharing faith,
              encouragement, burdens, joys, struggles, and resources. It means rejoicing with those who rejoice
              and weeping with those who weep. It means bearing one another&apos;s burdens and spurring one another
              on toward love and good deeds. Koino is built to help Christians experience this kind of
              koinonia — through Scripture, prayer, churches, events, and community — in a single place that
              feels warm, welcoming, and rooted in the truth of God&apos;s Word.
            </p>
          </div>

          {/* Verse callout */}
          <aside className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#F39B9B]/15 border border-[#F39B9B]/25 flex items-center justify-center mb-4">
                <BookOpen size={18} className="text-[#F39B9B]" />
              </div>
              <p className="text-base text-white font-semibold leading-relaxed italic mb-4">
                &quot;They devoted themselves to the apostles&apos; teaching and to fellowship, to the breaking of
                bread and to prayer.&quot;
              </p>
            </div>
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#F39B9B]">Acts 2:42</p>
              <p className="text-[10px] text-[#94A3B8] mt-1">The pattern of the early church.</p>
            </div>
          </aside>
        </div>
      </section>

      {/* Three pillars */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-white">Faith. Fellowship. Belong.</h2>
          <p className="text-xs text-[#A09DB1] mt-2">Three pillars that shape everything we build at Koino.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-[#1C1929] border border-white/[0.06] rounded-3xl p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#F39B9B]/20 to-[#7C3AED]/20 border border-white/[0.08] flex items-center justify-center">
                <p.icon size={24} className="text-[#F39B9B]" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">{p.title}</h3>
              <p className="text-xs text-[#A09DB1] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-white text-center mb-2">Everything for Your Faith Journey</h2>
        <p className="text-xs text-[#A09DB1] text-center mb-8 max-w-xl mx-auto">
          From Bible reading and Bible Comics to churches, events, prayer, Bible Trivia, and a Christian
          marketplace — Koino brings the Christian experience into one place.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex items-center justify-center mb-3">
                <f.icon size={18} className="text-[#A78BFA]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built With India in Mind */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8] text-[10px] font-bold uppercase tracking-wider mb-3">
            <MapPin size={11} /> Built With India in Mind
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Built With India in Mind</h2>
          <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto leading-relaxed">
            Koino is being built with India in mind — a country with a rich and growing Christian community
            across every state and language. From churches and events to Bible Trivia and local Christian
            businesses, we want Koino to feel native to believers across India.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: long-form explanation */}
          <div className="space-y-4 text-sm text-[#A09DB1] leading-relaxed">
            <p>
              India is home to a vast and diverse Christian community, with believers across every state and
              in nearly every major language. Koino is being built with India in mind, including thoughtful
              support for Indian languages and for local Christian communities. Our church directory, event
              listings, and Christian business directory are organized around Indian states and cities so
              that believers can find what is happening near them.
            </p>
            <p>
              Bible Trivia questions and competitions on Koino are designed with Indian Christian communities
              in mind — drawing on the rhythms of Indian church life, common Bible translations used across
              the country, and content that resonates with the Indian Christian experience. We want trivia,
              learning, and community engagement to feel relevant and accessible to believers everywhere.
            </p>
            <p>
              Our long-term vision is for experiences such as the Bible, Bible Trivia, learning content, and
              community content to become increasingly accessible in Indian and local languages. We are
              starting with a broad UI language layer and English Bible translations, and we are working
              actively toward adding Indian-language Bible translations over time. We will be transparent
              about what is available today versus what is still in progress.
            </p>
          </div>

          {/* Right: language + Bible coverage cards */}
          <div className="space-y-4">
            <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/25 flex items-center justify-center">
                  <Languages size={16} className="text-[#38BDF8]" />
                </div>
                <h3 className="text-sm font-bold text-white">UI Languages (Available Now)</h3>
              </div>
              <p className="text-[11px] text-[#A09DB1] mb-3 leading-relaxed">
                The Koino interface is currently available in the following languages:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <span key={lang} className="text-[10px] font-semibold px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#A09DB1]">
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#F39B9B]/15 border border-[#F39B9B]/25 flex items-center justify-center">
                  <BookOpen size={16} className="text-[#F39B9B]" />
                </div>
                <h3 className="text-sm font-bold text-white">Bible Translations (Available Now)</h3>
              </div>
              <ul className="space-y-2 text-[11px] text-[#A09DB1]">
                <li className="flex items-start gap-2">
                  <span className="text-[#22C55E] font-bold mt-0.5">✓</span>
                  <span><span className="text-white font-semibold">KJV</span> (King James Version, English)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22C55E] font-bold mt-0.5">✓</span>
                  <span><span className="text-white font-semibold">WEB</span> (World English Bible, English)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#F59E0B] font-bold mt-0.5">•</span>
                  <span>
                    <span className="text-white font-semibold">Indian-language Bible translations</span> are
                    not yet available — we are working to add them. UI language support does not yet mean
                    that the Bible text itself is available in that language.
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex items-center justify-center">
                  <Globe size={16} className="text-[#A78BFA]" />
                </div>
                <h3 className="text-sm font-bold text-white">Local Support</h3>
              </div>
              <p className="text-[11px] text-[#A09DB1] leading-relaxed">
                Churches, events, and the Christian business directory are organized around Indian states
                and cities, making it easier for believers to find local community and gatherings near them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-6 text-center max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#7C3AED]/20 rounded-3xl p-8">
          <h2 className="text-2xl font-extrabold text-white mb-2">Join the Koino community</h2>
          <p className="text-sm text-[#A09DB1] mb-5">It&apos;s free. Grow in faith, connect with believers, and belong.</p>
          <a href="/" className="inline-block px-8 py-3.5 bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all hover:-translate-y-px">
            Enter Koino
          </a>
        </div>
      </section>
    </PublicPageLayout>
  );
}
