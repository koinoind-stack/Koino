"use client";

import { useState } from "react";
import {
  Send,
  Loader2,
  Check,
  Mail,
  MessageCircle,
  Clock,
  Bug,
  Lightbulb,
  Handshake,
  Flag,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

const WHY_CONTACT = [
  { icon: Bug, title: "Report a problem or bug", desc: "Tell us about something that isn't working as expected." },
  { icon: Lightbulb, title: "Request a feature", desc: "Share an idea that would make Koino better for everyone." },
  { icon: Handshake, title: "Ask about partnerships", desc: "Explore how your church, ministry, or business can partner with us." },
  { icon: Flag, title: "Report inappropriate content", desc: "Help us keep Koino safe and Christ-honoring." },
  { icon: HelpCircle, title: "General inquiries", desc: "Any other question about Koino, your account, or the community." },
];

// WhatsApp channel URL — configurable; default points to the Koino channel.
const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb96qSoBFLgTRTxI5v2q";
const CONTACT_EMAIL = "hello@koino.in";

export default function ContactPageClient() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setSent(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="py-12 px-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F39B9B]/10 border border-[#F39B9B]/20 text-[#F39B9B] text-xs font-bold uppercase tracking-wider mb-5">
          <Mail size={12} /> Contact Us
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
          We&apos;d love to hear from you
        </h1>
        <p className="text-sm text-[#A09DB1] max-w-2xl mx-auto leading-relaxed">
          Whether you have a question, a bug to report, a feature to suggest, or just want to say hello —
          the Koino team is here to listen. Send us a message and we&apos;ll get back to you as soon as we can.
        </p>
      </section>

      {/* Why Contact Us? */}
      <section className="py-8 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-white mb-2">Why Contact Us?</h2>
          <p className="text-xs text-[#A09DB1]">A few common reasons believers reach out to Koino.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {WHY_CONTACT.map((w) => (
            <div
              key={w.title}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-[#F39B9B]/20 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F39B9B]/20 to-[#7C3AED]/20 border border-white/[0.08] flex items-center justify-center mb-3">
                <w.icon size={16} className="text-[#F39B9B]" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">{w.title}</h3>
              <p className="text-[10px] text-[#A09DB1] leading-relaxed">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Info + Form */}
      <section className="py-12 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Contact Information */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-white mb-2">Contact Information</h2>
            <p className="text-xs text-[#A09DB1] leading-relaxed mb-4">
              Reach the Koino team directly through any of the channels below. For most inquiries, the
              contact form on the right is the fastest way to get a response.
            </p>

            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-start gap-3 bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-[#F39B9B]/20 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F39B9B]/15 border border-[#F39B9B]/25 flex items-center justify-center shrink-0">
                <Mail size={16} className="text-[#F39B9B]" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-0.5">Email</p>
                <p className="text-sm text-white font-semibold break-all">{CONTACT_EMAIL}</p>
                <p className="text-[10px] text-[#A09DB1] mt-1">
                  Best for general inquiries, partnerships, and feature requests.
                </p>
              </div>
            </a>

            <a
              href={WHATSAPP_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4 hover:border-[#22C55E]/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/25 flex items-center justify-center shrink-0">
                <MessageCircle size={16} className="text-[#22C55E]" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-0.5">
                  WhatsApp Channel
                </p>
                <p className="text-sm text-white font-semibold">Follow Koino on WhatsApp</p>
                <p className="text-[10px] text-[#A09DB1] mt-1">
                  Get updates, announcements, and community news. (Link is configurable.)
                </p>
              </div>
            </a>

            <div className="flex items-start gap-3 bg-[#1C1929] border border-white/[0.06] rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/25 flex items-center justify-center shrink-0">
                <Clock size={16} className="text-[#A78BFA]" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-0.5">
                  Response Time
                </p>
                <p className="text-sm text-white font-semibold">2–3 business days</p>
                <p className="text-[10px] text-[#A09DB1] mt-1">
                  We typically respond within 2-3 business days. Thank you for your patience.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {sent ? (
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-2xl p-8 text-center">
                <Check size={36} className="mx-auto text-[#22C55E] mb-3" />
                <p className="text-base font-bold text-white mb-2">Message received</p>
                <p className="text-sm text-[#94A3B8] mb-4">
                  Thank you for contacting Koino. We have received your message.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white text-xs font-bold transition-all"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="bg-[#1C1929] border border-white/[0.06] rounded-3xl p-6 space-y-3"
              >
                <h2 className="text-base font-black text-white mb-1">Send a Message</h2>
                <p className="text-[11px] text-[#A09DB1] mb-3">
                  Fields marked with * are required.
                </p>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="neo-input text-sm w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="neo-input text-sm w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Phone <span className="text-[#64748B] normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="neo-input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="neo-input text-sm w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    Message *
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="neo-input text-sm h-32 resize-none w-full"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#F39B9B] hover:bg-[#E27B7B] text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all hover:-translate-y-px disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={16} /> Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
