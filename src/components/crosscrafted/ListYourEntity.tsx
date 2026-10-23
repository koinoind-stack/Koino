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
} from "lucide-react";
import { toast } from "sonner";
import { INDIAN_STATES, LANGUAGES, BUSINESS_CATEGORIES, type ServiceTime } from "@/lib/crosscrafted-data";
import ImagePicker from "@/components/crosscrafted/ImagePicker";

type Props = {
  variant: "church" | "business";
};

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
    service_times: string;
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
    service_times: "",
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
      if (!formData.name || !formData.description || !formData.city || !formData.state) {
        toast.error("Please fill in all required fields.");
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
            contact_name: formData.contact_name,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone,
            whatsapp_number: formData.whatsapp_number,
            service_times: formData.serviceRows.filter((s) => s.time && s.day),
            languages: formData.languages,
            images: formData.images,
            cover_image: formData.images[0] || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to submit church");
        }
        // Success — church created with status=PENDING
        setSubmitted(true);
        toast.success("Church submitted!", {
          description: "Our team will review and approve within 48 hours.",
        });
      } catch (err: any) {
        console.error("[ListYourEntity church submit] Error:", err);
        toast.error(err.message || "Failed to submit church. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ─── BUSINESS variant: still uses the legacy fake flow ───
    // (Businesses will be migrated to a real DB pipeline in a separate task.)
    setSubmitted(true);
    toast.success("Business listing submitted!", {
      description: "Our team will review and approve within 48 hours.",
    });
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
          Our team will review your submission and approve it within 48 hours. You'll receive
          an email confirmation once it's live.
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
              service_times: "",
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
    <div className="max-w-[680px] mx-auto px-4 py-5">
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
            <Building2 size={16} className="text-[#22C55E]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-0.5">Why list with us?</p>
            <p className="text-[11px] text-[#A09DB1] leading-relaxed">
              {variant === "church"
                ? "Reach 5,000+ active believers looking for a church home. Add your service times, languages, and denomination to help people find you."
                : "Connect with thousands of Christian buyers across India. No payment gateway needed — buyers contact you directly via WhatsApp."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            {variant === "church" ? "Church" : "Business"} Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="neo-input text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="neo-input h-24 resize-none text-sm"
            placeholder={variant === "church" ? "Tell people about your church..." : "What does your business sell?"}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
              <MapPin size={10} className="inline mr-0.5" /> State
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
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="neo-input text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            Address
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="neo-input text-sm"
            required
          />
        </div>

        {variant === "church" ? (
          <>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Denomination
              </label>
              <input
                type="text"
                value={formData.denomination}
                onChange={(e) => setFormData({ ...formData, denomination: e.target.value })}
                className="neo-input text-sm"
                placeholder="Non-denominational"
              />
            </div>

            {/* Multi-row service times */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Clock size={10} className="inline mr-0.5" /> Service Times
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
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#64748B] mt-1.5">
                Add one row per service. e.g. English 8-11am, Hindi 11:30-2pm.
              </p>
            </div>

            {/* Church Photos */}
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
                Visitors can contact your church directly on WhatsApp for inquiries.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Business Photos */}
            <ImagePicker
              images={formData.images}
              onChange={(images) => setFormData({ ...formData, images })}
              max={5}
              label="Business Photos"
            />
            {/* Business Category — single source of truth (BUSINESS_CATEGORIES) */}
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
              <p className="text-[10px] text-[#64748B] mt-1">
                Helps users discover your business by category in the Christian Business Directory.
              </p>
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
              <p className="text-[10px] text-[#64748B] mt-1">
                Visitors can contact your business directly on WhatsApp for inquiries.
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
            <Globe size={10} className="inline mr-0.5" /> Languages
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
        </div>

        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
            Contact Details
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                <User size={10} className="inline mr-0.5" /> Contact Name
              </label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="neo-input text-sm"
                required
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
                  required
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
                  placeholder="+91"
                  required
                />
              </div>
            </div>
          </div>
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
            : <><Send size={14} /> Submit Listing</>
          }
        </button>
      </form>
    </div>
  );
}
