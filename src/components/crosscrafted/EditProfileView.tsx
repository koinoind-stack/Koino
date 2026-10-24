"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  Globe,
  Instagram,
  Youtube,
  Facebook,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import { api, type SocialUser } from "@/components/social/types";
import { notifyProfileUpdated } from "@/lib/supabase/use-user";

type ProfileData = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  bio: string | null;
  state: string | null;
  city: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  usernameChangedAt: string | null;
  website: string | null;
  instagram: string | null;
  youtube: string | null;
  facebook: string | null;
  twitter: string | null;
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Jammu & Kashmir", "Ladakh",
  "Puducherry", "Chandigarh", "Andaman & Nicobar", "Dadra & Nagar Haveli and Daman & Diu", "Lakshadweep",
];

const COOLDOWN_DAYS = 30;

/**
 * Full-screen Edit Profile: photo upload/preview/change/remove, username
 * with availability check + 30-day cooldown, bio with counter, location,
 * gender, DOB. Server-authoritative — the API is the only writer.
 */
export default function EditProfileView({ onDone }: { onDone: () => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form fields
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [state_, setState] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");

  // social / website links (stored server-side as normalized https URLs)
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");

  // avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // username availability (debounced)
  const [availState, setAvailState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const usernameChanged = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<ProfileData>("/api/profile");
        setProfile(data);
        setName(data.name || "");
        setBio(data.bio || "");
        setUsername(data.username || "");
        setState(data.state || "");
        setCity(data.city || "");
        setGender(data.gender || "");
        setDob(data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "");
        setWebsite(data.website || "");
        setInstagram(data.instagram || "");
        setYoutube(data.youtube || "");
        setFacebook(data.facebook || "");
        setTwitter(data.twitter || "");
        if (data.usernameChangedAt) {
          const next = new Date(
            new Date(data.usernameChangedAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
          );
          setCooldownUntil(next.toISOString());
        }
      } catch (err) {
        toast.error((err as Error).message);
        onDone();
      } finally {
        setLoading(false);
      }
    })();
  }, [onDone]);

  // Username availability debounce
  useEffect(() => {
    const handle = username.trim().toLowerCase();
    const original = (profile?.username || "").toLowerCase();
    if (!handle) return setAvailState("idle");
    if (handle === original) return setAvailState("idle");
    usernameChanged.current = true;
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return setAvailState("invalid");
    setAvailState("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/profile/check-username?username=${encodeURIComponent(handle)}`,
        );
        const data = await res.json();
        setAvailState(data.available ? "available" : "taken");
      } catch {
        setAvailState("idle");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [username, profile?.username]);

  function pickAvatar(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG, WEBP images are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }
    setAvatarFile(file);
    setAvatarRemoved(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function removeAvatar() {
    if (!confirm("Remove your profile photo?")) return;
    try {
      if (profile?.image) {
        // Only hit the server when there is an existing photo to remove.
        await api("/api/profile/upload-avatar", { method: "DELETE" });
      }
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarRemoved(true);
      toast.success("Photo removed");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function uploadAvatar(): Promise<string | null> {
    if (!avatarFile) return null;
    const form = new FormData();
    form.append("file", avatarFile);
    const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Photo upload failed");
    return data.url;
  }

  async function save() {
    if (saving) return;
    if (availState === "taken") {
      toast.error("That username is already taken");
      return;
    }
    if (availState === "invalid") {
      toast.error("Username must be 3-20 characters: lowercase letters, numbers, underscores");
      return;
    }
    setSaving(true);
    try {
      // 1. Avatar (upload or remove) — before the profile patch so the new
      // photo URL can ride along.
      let imageUrl: string | null | undefined = undefined;
      if (avatarRemoved) imageUrl = null;
      else if (avatarFile) imageUrl = await uploadAvatar();

      // 2. Profile fields.
      const body: Record<string, unknown> = {};
      if (name.trim() !== (profile?.name || "")) body.name = name.trim();
      if (bio.trim() !== (profile?.bio || "")) body.bio = bio.trim();
      const handle = username.trim().toLowerCase();
      if (handle && handle !== (profile?.username || "").toLowerCase()) body.username = handle;
      if (state_ !== (profile?.state || "")) body.state = state_;
      if (city.trim() !== (profile?.city || "")) body.city = city.trim();
      if (gender !== (profile?.gender || "")) body.gender = gender || null;
      const currentDob = profile?.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "";
      if (dob !== currentDob) body.dateOfBirth = dob || null;
      if (imageUrl !== undefined) body.image = imageUrl;
      if (website.trim() !== (profile?.website || "")) body.website = website.trim();
      if (instagram.trim() !== (profile?.instagram || "")) body.instagram = instagram.trim();
      if (youtube.trim() !== (profile?.youtube || "")) body.youtube = youtube.trim();
      if (facebook.trim() !== (profile?.facebook || "")) body.facebook = facebook.trim();
      if (twitter.trim() !== (profile?.twitter || "")) body.twitter = twitter.trim();

      if (Object.keys(body).length > 0) {
        await api("/api/profile", { method: "PATCH", body: JSON.stringify(body) });
      }

      // 3. Notify every consumer (header identity, onboarding gates, etc.)
      // so edits are visible app-wide instantly.
      notifyProfileUpdated();
      toast.success("Profile updated");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const cooldownActive = cooldownUntil ? new Date(cooldownUntil).getTime() > Date.now() : false;
  const avatarShown: string | null = avatarRemoved
    ? null
    : avatarPreview || profile?.image || null;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto px-3 md:px-4 pt-4 pb-24 md:pb-8">
      {/* header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onDone} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft size={18} className="text-[#94A3B8]" />
        </button>
        <h1 className="text-lg font-extrabold text-white">Edit profile</h1>
      </div>

      {/* avatar */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="relative">
          {avatarShown ? (
            <Image src={avatarShown} alt="" width={96} height={96} className="w-24 h-24 rounded-full object-cover" unoptimized />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white text-3xl font-black">
              {(name || profile?.username || profile?.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center text-white shadow-lg"
          >
            <Camera size={16} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pickAvatar(e.target.files[0])}
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-bold">
          <button onClick={() => fileRef.current?.click()} className="text-[#7C3AED] hover:text-white">
            Change photo
          </button>
          {avatarShown && (
            <button onClick={removeAvatar} className="text-[#EF4444]/80 hover:text-[#EF4444] flex items-center gap-1">
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* fields */}
      <div className="space-y-5">
        <Field label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Your name"
            className={inputCls}
          />
        </Field>

        <Field label="Username">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] text-sm font-bold">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              maxLength={20}
              placeholder="your_handle"
              className={`${inputCls} pl-8`}
            />
            {availState === "checking" && (
              <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] animate-spin" />
            )}
            {availState === "available" && (
              <Check size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400" />
            )}
            {(availState === "taken" || availState === "invalid") && (
              <AlertTriangle size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400" />
            )}
          </div>
          <p className={`text-[11px] mt-1.5 ${availState === "available" ? "text-green-400" : availState === "taken" || availState === "invalid" ? "text-red-400" : "text-[#64748B]"}`}>
            {availState === "available" && `${"@" + username} is available`}
            {availState === "taken" && "That username is already taken"}
            {availState === "invalid" && "3-20 characters: lowercase letters, numbers, underscores"}
            {availState === "idle" && "You can change your username once every 30 days"}
          </p>
          {cooldownActive && cooldownUntil && (
            <p className="text-[11px] mt-1 text-amber-400">
              Next change allowed after {new Date(cooldownUntil).toLocaleDateString()}
            </p>
          )}
        </Field>

        <Field label={`Bio (${bio.length}/500)`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="A little about you and your faith journey…"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <Field label="Social links">
          <div className="space-y-2.5">
            <LinkInput icon={Globe} label="Website" value={website} onChange={setWebsite} placeholder="yourwebsite.com" />
            <LinkInput icon={Instagram} label="Instagram" value={instagram} onChange={setInstagram} placeholder="@yourhandle" />
            <LinkInput icon={Youtube} label="YouTube" value={youtube} onChange={setYoutube} placeholder="@yourchannel" />
            <LinkInput icon={Facebook} label="Facebook" value={facebook} onChange={setFacebook} placeholder="facebook.com/yourpage" />
            <LinkInput icon={Twitter} label="X (Twitter)" value={twitter} onChange={setTwitter} placeholder="@yourhandle" />
          </div>
          <p className="text-[11px] mt-1.5 text-[#64748B]">
            Paste a link or type your @handle — leave blank to hide. Links show on your public profile.
          </p>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <select value={state_} onChange={(e) => { setState(e.target.value); setCity(""); }} className={inputCls}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
              placeholder="City"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving || availState === "taken" || availState === "invalid"}
        className="w-full mt-8 py-3.5 rounded-2xl bg-[#7C3AED] text-white font-extrabold disabled:opacity-40 shadow-[0_0_30px_rgba(124,58,237,0.3)]"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#7C3AED]";

function LinkInput({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        placeholder={placeholder}
        aria-label={label}
        className={`${inputCls} pl-10`}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
