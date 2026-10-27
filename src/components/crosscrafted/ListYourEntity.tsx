"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Mail,
  Phone,
  User,
  MapPin,
  Clock,
  Globe,
  Sparkles,
  Check,
  Send,
  Plus,
  Trash2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { INDIAN_STATES, LANGUAGES, BUSINESS_CATEGORIES, type ServiceTime } from "@/lib/crosscrafted-data";
import ImagePicker from "@/components/crosscrafted/ImagePicker";

type Props = {
  variant: "church" | "business";
};

function SectionHeading({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="pt-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#C4B5FD] flex items-center gap-1.5 mb-3">
        <span className="w-6 h-6 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/25 flex items-center justify-center text-[#A78BFA]">
          {icon}
        </span>
        {title}
      </p>
      {hint && <p className="text-[10px] text-[#64748B] -mt-2 mb-3">{hint}</p>}
    </div>
  );
}

function RequiredMark() {
  return <span className="text-[#F39B9B] ml-0.5" title="Required">*</span>;
}

export default function ListYourEntity({ variant }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    state: string;
    city: string;
    location: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    denomination: string;
    businessCategory: string;
    languages: string[];
    images: string[];
    whatsapp_number: string;
    serviceRows: ServiceTime[];
  }>({
    name: "",
    description: "",
    state: "",
    city: "",
    location: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    denomination: "",
    businessCategory: "",
    languages: [],
    images: [],
    whatsapp_number: "",
    serviceRows: [{ language: "English", day: "Sunday", time: "" }],
  });

  const addServiceRow = () => {
    setFormData((prev) => ({
      ...prev,
      serviceRows: [...prev.serviceRows, { language: "English", day: "Sunday", time: "" }],
    }));
  };

  const removeServiceRow = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      serviceRows: prev.serviceRows.filter((_, i) => i !== idx),
    }));
  };

  const updateServiceRow = (idx: number, field: keyof ServiceTime, value: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceRows: prev.serviceRows.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const handleLanguageToggle = (lang: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ─── CHURCH variant: real DB insert via POST /api/churches ───
    // Creates a church with status=PENDING. Admin must approve it
    // before it appears in the public Church Directory.
    if (variant === "church") {
      if (!formData.name || !formData.description || !formData.city || !formData.state || !formData.location) {
        toast.error("Please fill in all required fields (marked with *).");
        return;
      }
      if (!formData.languages.length) {
        toast.error("Please select at least one service language.");
        return;
      }
      const withTime = formData.serviceRows.filter((s) => s.time.trim());
      if (!withTime.length) {
        toast.error("Please add at least one service time.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/churches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            denomination: formData.denomination,
            state: formData.state,
            city: formData.city,
            location: formData.location,
            address: formData.location, // reuse location field as address
            contact_name: formData.contact_name || null,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            whatsapp_number: formData.whatsapp_number || null,
            service_times: withTime,
            languages: formData.languages,
            images: formData.images,
            cover_image: formData.images[0] || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          // Duplicate submission — server detected the same listing recently
          toast.error("Already submitted", { description: data.error || "You already submitted this church in the last 24 hours." });
          return;
        }
        if (res.status === 429) {
          toast.error("Slow down a little", { description: data.error || "Too many submissions — please wait a while." });
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || "Failed to submit church");
        }
        // Success — church created with status=PENDING
        setSubmitted(true);
        toast.success("Church submitted!", {
          description: "Our team reviews every listing before it appears in the directory.",
        });
      } catch (err: any) {
        console.error("[ListYourEntity church submit] Error:", err);
        toast.error(err.message || "Failed to submit church. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ─── BUSINESS variant: real database pipeline (admin approval required) ───
    if (!formData.businessCategory) {
      toast.error("Please choose a business category");
      return;
    }
    if (!formData.whatsapp_number && !formData.contact_phone) {
      toast.error("Please add a WhatsApp or phone number for the business");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          category: formData.businessCategory,
          state: formData.state || null,
          city: formData.city || null,
          address: formData.location || null,
          images: formData.images,
          whatsappNumber: formData.whatsapp_number || null,
          phone: formData.contact_phone || null,
          email: formData.contact_email || null,
          ownerName: formData.contact_name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit business. Please try again.");
      setSubmitted(true);
      toast.success("Business listing submitted!", {
        description: "Our team will review and approve it before it appears in the directory.",
      });
    } catch (err: unknown) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#22C55E]/20 to-[#3B82F6]/20 border border-[#22C55E]/30 mb-4"
        >
          <Check size={36} className="text-[#22C55E]" />
        </motion.div>
        <h2 className="text-2xl font-extrabold text-white mb-2">Submission Received!</h2>
        <p className="text-sm text-[#A09DB1] mb-6 max-w-sm mx-auto">
          Thanks for adding your {variant === "church" ? "church" : "business"} to Koino.
          Our team reviews every listing before it appears in the directory — this usually takes
          about 48 hours. You can keep using Koino while you wait.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setFormData({
              name: "",
              description: "",
              state: "",
              city: "",
              location: "",
              contact_name: "",
              contact_email: "",
              contact_phone: "",
              denomination: "",
              businessCategory: "",
              languages: [],
              images: [],
              whatsapp_number: "",
              serviceRows: [{ language: "English", day: "Sunday", time: "" }],
            });
          }}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #A855F7, #EC4899)" }}
        >
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-28 md:pb-5">
      <div className="mb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/25 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider mb-2">
          <Sparkles size={11} />
          {variant === "church" ? "Church Directory" : "Marketplace"}
        </div>
        <h1 className="text-xl font-bold text-white">
          {variant === "church" ? "List Your Church" : "List Your Business"}
        </h1>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          {variant === "church"
            ? "Help believers find a community"
            : "Reach Christian buyers across India"}
        </p>
      </div>

      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#22C55E]/15 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center shrink-0">
            <ShieldCheck size={16} className="text-[#22C55E]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-0.5">Reviewed before publication</p>
            <p className="text-[11px] text-[#A09DB1] leading-relaxed">
              {variant === "church"
                ? "Every listing is checked by a Koino admin before it appears in the public directory — this keeps the directory trustworthy. You can submit once and check back later; duplicate submissions aren't needed."
                : "Connect with Christian buyers across India. No payment gateway needed — buyers contact you directly via WhatsApp."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* ─── SECTION 1: Church Information ─── */}
        <SectionHeading icon={<Building2 size={12} />} title={variant === "church" ? "Church Information" : "Business Information"} />
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            {variant === "church" ? "Church" : "Business"} Name<RequiredMark />
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="neo-input text-sm"
            required
            maxLength={300}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Description<RequiredMark />
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="neo-input h-24 resize-none text-sm"
            placeholder={variant === "church" ? "Tell people about your church, its vision and what a first visit looks like..." : "What does your business sell?"}
            required
            maxLength={5000}
          />
        </div>

        {variant === "church" && (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              Denomination
            </label>
            <input
              type="text"
              value={formData.denomination}
              onChange={(e) => setFormData({ ...formData, denomination: e.target.value })}
              className="neo-input text-sm"
              placeholder="e.g. Assemblies of God, Catholic, Baptist, Non-denominational"
              maxLength={200}
            />
          </div>
        )}

        {/* ─── SECTION 2: Location ─── */}
        <SectionHeading icon={<MapPin size={12} />} title="Location" hint="Shown on your public listing so people can find you." />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              State<RequiredMark />
            </label>
            <select
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="neo-input text-sm"
              required
            >
              <option value="">Select</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              City<RequiredMark />
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="neo-input text-sm"
              required
              maxLength={100}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Address<RequiredMark />
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="neo-input text-sm"
            placeholder="Street / area / landmark"
            required
            maxLength={500}
          />
          <p className="text-[10px] text-[#64748B] mt-1">
            Used for the map directions button on your listing.
          </p>
        </div>

        {variant === "church" && (
          <>
            {/* ─── SECTION 3: Services & Languages ─── */}
            <SectionHeading icon={<Clock size={12} />} title="Services & Languages" hint="Add one row per service — e.g. English Sunday 8:00 AM, Hindi Sunday 11:00 AM." />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Service Times<RequiredMark />
                </label>
                <button
                  type="button"
                  onClick={addServiceRow}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold hover:bg-[#22C55E]/25 transition-all"
                >
                  <Plus size={10} /> Add Service
                </button>
              </div>
              <div className="space-y-2">
                {formData.serviceRows.map((svc, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <select
                      value={svc.language}
                      onChange={(e) => updateServiceRow(idx, "language", e.target.value)}
                      className="neo-input text-xs w-28 py-2"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <select
                      value={svc.day}
                      onChange={(e) => updateServiceRow(idx, "day", e.target.value)}
                      className="neo-input text-xs w-28 py-2"
                    >
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={svc.time}
                      onChange={(e) => updateServiceRow(idx, "time", e.target.value)}
                      className="neo-input text-xs flex-1 py-2"
                      placeholder="8:00 AM - 11:00 AM"
                    />
                    {formData.serviceRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeServiceRow(idx)}
                        className="p-2 text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                        aria-label="Remove this service time"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Languages<RequiredMark />
              </label>
              <div className="flex flex-wrap gap-1.5 p-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                {LANGUAGES.map((lang) => {
                  const selected = formData.languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleLanguageToggle(lang)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        selected
                          ? "bg-[#22C55E] text-slate-950"
                          : "bg-white/[0.04] text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
              {formData.languages.length === 0 && (
                <p className="text-[10px] text-[#F59E0B] mt-1.5">Select at least one language — visitors filter by it.</p>
              )}
            </div>

            {/* ─── SECTION 4: Photos ─── */}
            <SectionHeading icon={<Sparkles size={12} />} title="Photos" hint="Up to 5 photos. The first one becomes the cover image on your listing." />
            <ImagePicker
              images={formData.images}
              onChange={(images) => setFormData({ ...formData, images })}
              max={5}
              label="Church Photos"
            />

            {/* WhatsApp */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                <Phone size={10} className="inline mr-0.5" /> WhatsApp Number
              </label>
              <input
                type="tel"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                className="neo-input text-sm"
                placeholder="+91 98765 43210"
              />
              <p className="text-[10px] text-[#64748B] mt-1">
                Shown as a &quot;Contact on WhatsApp&quot; button on your public listing.
              </p>
            </div>
          </>
        )}

        {variant !== "church" && (
          <>
            <ImagePicker
              images={formData.images}
              onChange={(images) => setFormData({ ...formData, images })}
              max={5}
              label="Business Photos"
            />
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Business Category *
              </label>
              <select
                value={formData.businessCategory || ""}
                onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                className="neo-input text-sm"
                required
              >
                <option value="">Select a category</option>
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                <Phone size={10} className="inline mr-0.5" /> WhatsApp Number *
              </label>
              <input
                type="tel"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                className="neo-input text-sm"
                placeholder="+91 98765 43210"
                required
              />
            </div>
          </>
        )}

        {/* ─── SECTION 5: Contact Details ─── */}
        <SectionHeading icon={<User size={12} />} title="Contact Details" hint="For our review team to reach you. Only the contact NAME appears on your public listing — email and phone are never shown publicly." />
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            <User size={10} className="inline mr-0.5" /> Contact Name
          </label>
          <input
            type="text"
            value={formData.contact_name}
            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            className="neo-input text-sm"
            placeholder="Who should visitors ask for?"
            maxLength={200}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              <Mail size={10} className="inline mr-0.5" /> Email
            </label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="neo-input text-sm"
              placeholder="For the review team only"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              <Phone size={10} className="inline mr-0.5" /> Phone
            </label>
            <input
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              className="neo-input text-sm"
              placeholder="For the review team only"
              maxLength={30}
            />
          </div>
        </div>

        <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck size={14} className="text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#A09DB1] leading-relaxed">
            <span className="font-bold text-white">Admin review required.</span> Your listing will appear
            in the public directory only after a Koino admin approves it. Fields marked{" "}
            <span className="text-[#F39B9B] font-bold">*</span> are required.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-2xl text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:-translate-y-px text-white disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #22C55E, #3B82F6)",
            boxShadow: "0 4px 16px rgba(34,197,94,0.25)",
          }}
        >
          {submitting
            ? <><Loader2 size={14} className="animate-spin" /> Submitting…</>
            : <><Send size={14} /> Submit for Review</>
          }
        </button>
      </form>
    </div>
  );
}
