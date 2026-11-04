"use client";

/**
 * Admin — Video Library tab (Part 5).
 * Full CRUD for curated video entries: add via YouTube URL (official oEmbed
 * metadata fetch), edit everything including Bible passage links, publish /
 * unpublish, feature in the feed rail, check broken links, delete.
 * Reports against videos appear in the existing Reports tab.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard, Search, Plus, Pencil, Trash2, Star, Link2,
  ExternalLink, Loader2, RefreshCw, X, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { VIDEO_CATEGORIES, VIDEO_LANGUAGES, parseDurationInput, formatDuration, formatBibleRef } from "@/lib/videos";
import { BIBLE_BOOKS } from "@/lib/bible-data";

type AdminVideo = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnailUrl: string | null;
  youtubeId: string | null;
  durationSec: number | null;
  category: string;
  language: string;
  status: string;
  featured: boolean;
  embeddable: boolean;
  viewCount: number;
  createdAt: string;
  _count: { bibleRefs: number; saves: number };
  pendingReports: number;
};

type BibleRefRow = {
  bookId: string;
  chapterStart: string;
  verseStart: string;
  chapterEnd: string;
  verseEnd: string;
};

type ResolvedMeta = {
  youtubeId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  embeddable: boolean;
};

const emptyForm = {
  id: "",
  youtubeUrlOrId: "",
  title: "",
  summary: "",
  description: "",
  category: "bible_movies",
  language: "en",
  subtitles: [] as string[],
  dubs: [] as string[],
  durationInput: "",
  contentWarning: "",
  sourceName: "",
  rightsNote: "",
  thumbnailUrl: "",
  featured: false,
  refs: [] as BibleRefRow[],
};

// Live "Shows as: Genesis 1–50" preview for a passage row, so a value typed
// into the wrong box (e.g. "50" into the verse field instead of "to ch. 50")
// is visible before saving. tip = input looks like it may be a chapter range
// typed into the verse box (a single verse above 3 with no chapter end).
function refPreview(r: BibleRefRow): { text: string; tip: string | null } | null {
  const chapterStart = parseInt(r.chapterStart, 10);
  if (!r.bookId || !Number.isFinite(chapterStart) || chapterStart < 1) return null;
  const text = formatBibleRef(
    {
      bookId: r.bookId,
      chapterStart,
      verseStart: r.verseStart ? parseInt(r.verseStart, 10) : null,
      chapterEnd: r.chapterEnd ? parseInt(r.chapterEnd, 10) : null,
      verseEnd: r.verseEnd ? parseInt(r.verseEnd, 10) : null,
    },
    (id) => BIBLE_BOOKS.find((b) => b.id === id)?.name || id
  );
  const verse = r.verseStart ? parseInt(r.verseStart, 10) : null;
  const tip = !r.chapterEnd && verse !== null && verse > 3
    ? "a chapter range goes in the first two boxes — e.g. 1 and 50"
    : null;
  return { text, tip };
}

export default function VideosTab() {
  const t = useTranslation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedMeta | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/videos?${params.toString()}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load videos");
      setItems(body.videos || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, firstLoad.current ? 0 : 300);
    firstLoad.current = false;
    return () => clearTimeout(t);
  }, [load]);

  function openCreate() {
    setForm({ ...emptyForm });
    setResolved(null);
    setShowForm(true);
  }

  async function openEdit(v: AdminVideo) {
    try {
      const res = await fetch(`/api/admin/videos/${v.id}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load the video");
      const vid = body.video;
      const parseList = (s: string): string[] => {
        try {
          const arr = JSON.parse(s);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      };
      setForm({
        id: vid.id,
        youtubeUrlOrId: vid.youtubeId || "",
        title: vid.title || "",
        summary: vid.summary || "",
        description: vid.description || "",
        category: vid.category || "bible_movies",
        language: vid.language || "en",
        subtitles: parseList(vid.subtitleLanguages),
        dubs: parseList(vid.dubLanguages),
        durationInput: vid.durationSec ? formatDuration(vid.durationSec) : "",
        contentWarning: vid.contentWarning || "",
        sourceName: vid.sourceName || "",
        rightsNote: vid.rightsNote || "",
        thumbnailUrl: vid.thumbnailUrl || "",
        featured: vid.featured,
        refs: (vid.bibleRefs || []).map((r: { bookId: string; chapterStart: number; verseStart: number | null; chapterEnd: number | null; verseEnd: number | null }) => ({
          bookId: r.bookId,
          chapterStart: String(r.chapterStart),
          verseStart: r.verseStart ? String(r.verseStart) : "",
          chapterEnd: r.chapterEnd ? String(r.chapterEnd) : "",
          verseEnd: r.verseEnd ? String(r.verseEnd) : "",
        })),
      });
      setResolved(
        vid.youtubeId
          ? { youtubeId: vid.youtubeId, title: vid.title, author: "", thumbnailUrl: vid.thumbnailUrl || "", embeddable: vid.embeddable }
          : null,
      );
      setShowForm(true);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function fetchMeta() {
    if (resolving) return;
    const url = form.youtubeUrlOrId.trim();
    if (!url) {
      toast.error("Paste a YouTube URL or video id first");
      return;
    }
    setResolving(true);
    try {
      const res = await fetch("/api/admin/videos/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not fetch YouTube metadata");
      setResolved({
        youtubeId: body.youtubeId,
        title: body.title || "",
        author: body.author || "",
        thumbnailUrl: body.thumbnailUrl || "",
        embeddable: body.embeddable !== false,
      });
      // Prefill only fields the admin hasn't typed into yet.
      if (!form.title.trim() && body.title) setForm((f) => ({ ...f, title: body.title }));
      if (!form.sourceName.trim() && body.author) setForm((f) => ({ ...f, sourceName: `YouTube — ${body.author}` }));
      toast.success(t("admin.videos.toast.metadata"));
    } catch (err) {
      setResolved(null);
      toast.error((err as Error).message);
    } finally {
      setResolving(false);
    }
  }

  async function save(publish?: boolean) {
    if (saving) return;
    const title = form.title.trim();
    if (title.length < 2) {
      toast.error("Please enter a title (at least 2 characters)");
      return;
    }
    if (!form.youtubeUrlOrId.trim()) {
      toast.error("Please paste the YouTube URL or video id");
      return;
    }
    const durationSec = form.durationInput.trim() ? parseDurationInput(form.durationInput) : null;
    if (form.durationInput.trim() && durationSec == null) {
      toast.error("Duration looks invalid — use mm:ss or h:mm:ss");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        youtubeUrlOrId: form.youtubeUrlOrId.trim(),
        summary: form.summary.trim() || null,
        description: form.description.trim() || null,
        category: form.category,
        language: form.language,
        subtitleLanguages: form.subtitles,
        dubLanguages: form.dubs,
        durationSec,
        contentWarning: form.contentWarning.trim() || null,
        sourceName: form.sourceName.trim() || null,
        rightsNote: form.rightsNote.trim() || null,
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        featured: form.featured,
        bibleRefs: form.refs
          .filter((r) => r.bookId && r.chapterStart)
          .map((r) => ({
            bookId: r.bookId,
            chapterStart: parseInt(r.chapterStart, 10) || 1,
            verseStart: r.verseStart ? parseInt(r.verseStart, 10) : null,
            chapterEnd: r.chapterEnd ? parseInt(r.chapterEnd, 10) : null,
            verseEnd: r.verseEnd ? parseInt(r.verseEnd, 10) : null,
          })),
        status: publish === undefined ? undefined : publish ? "published" : form.id ? undefined : "draft",
      };
      const res = await fetch(form.id ? `/api/admin/videos/${form.id}` : "/api/admin/videos", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save the video");
      toast.success(publish ? "Video published" : form.id ? "Video updated" : "Draft saved");
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, data: Record<string, unknown>, confirmText?: string) {
    if (busyId) return;
    if (confirmText && !confirm(confirmText)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Action failed");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function checkLink(v: AdminVideo) {
    if (busyId || !v.youtubeId) return;
    setBusyId(v.id);
    try {
      const res = await fetch("/api/admin/videos/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${v.youtubeId}` }),
      });
      const body = await res.json();
      if (res.ok && body.ok) {
        await patch(v.id, { embeddable: body.embeddable !== false });
        toast.success("Link is valid and embeddable");
      } else if (body.reason === "embedding_disabled") {
        await patch(v.id, { embeddable: false });
        toast.warning("Embedding is disabled for this video — watch page shows a YouTube link instead");
      } else {
        toast.error(body.error || "Link check failed");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(v: AdminVideo) {
    if (busyId) return;
    if (!confirm(`Delete "${v.title}" permanently? Bible links, watch progress and saved lists for it are removed too. Posts sharing it stay up.`)) return;
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/admin/videos/${v.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");
      toast.success(t("admin.videos.toast.deleted"));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function toggleLang(list: "subtitles" | "dubs", code: string) {
    setForm((f) => {
      const cur = f[list];
      return { ...f, [list]: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] };
    });
  }

  function setRefRow(i: number, patchRow: Partial<BibleRefRow>) {
    setForm((f) => ({ ...f, refs: f.refs.map((r, idx) => (idx === i ? { ...r, ...patchRow } : r)) }));
  }

  return (
    <div>
      {/* ─── toolbar ─── */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.videos.searchPlaceholder")}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-[#13294A]"
        >
          <option value="">All statuses</option>
          <option value="published">{t("common.status.published")}</option>
          <option value="draft">{t("common.status.draft")}</option>
          <option value="unpublished">Unpublished</option>
        </select>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold shrink-0"
        >
          <Plus size={15} /> {t("admin.videos.add")}
        </button>
      </div>

      {/* ─── list ─── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#2563EB]/30 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Clapperboard size={26} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#94A3B8]">{t("admin.videos.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((v) => (
            <li key={v.id} className="rounded-2xl bg-[#0F2038]/60 border border-white/[0.05] px-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-black/60 shrink-0">
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#64748B]">
                      <Clapperboard size={14} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white truncate">{v.title}</p>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide ${
                        v.status === "published"
                          ? "bg-[#22C55E]/15 text-[#4ADE80]"
                          : v.status === "draft"
                            ? "bg-[#F5B84A]/15 text-[#FCD34D]"
                            : "bg-white/[0.06] text-[#94A3B8]"
                      }`}
                    >
                      {v.status}
                    </span>
                    {v.featured && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#2563EB]/20 text-[#93C5FD] text-[9px] font-extrabold uppercase">
                        Featured
                      </span>
                    )}
                    {!v.embeddable && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#F5B84A]/15 text-[#FCD34D] text-[9px] font-extrabold uppercase">
                        Link-out only
                      </span>
                    )}
                    {v.pendingReports > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#EF4444]/15 text-[#FCA5A5] text-[9px] font-extrabold uppercase">
                        {v.pendingReports} report{v.pendingReports > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    {VIDEO_CATEGORIES.find((c) => c.id === v.category)?.label || v.category}
                    {" · "}
                    {VIDEO_LANGUAGES.find((l) => l.code === v.language)?.name || v.language}
                    {v.durationSec ? ` · ${formatDuration(v.durationSec)}` : ""}
                    {` · ${v._count.bibleRefs} Bible link${v._count.bibleRefs === 1 ? "" : "s"}`}
                    {` · ${v.viewCount} views`}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg bg-white/[0.05] text-[#94A3B8] hover:text-white" title={t("common.edit")}>
                      <Pencil size={13} />
                    </button>
                    {v.status === "published" ? (
                      <button
                        onClick={() => patch(v.id, { status: "unpublished" }, "Unpublish this video (it disappears from the public library)?")}
                        className="p-1.5 rounded-lg bg-white/[0.05] text-[#94A3B8] hover:text-white"
                        title="Unpublish"
                      >
                        <X size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => patch(v.id, { status: "published" })}
                        className="p-1.5 rounded-lg bg-[#22C55E]/15 text-[#4ADE80] hover:bg-[#22C55E]/25"
                        title={t("common.action.publish")}
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => patch(v.id, { featured: !v.featured })}
                      className={`p-1.5 rounded-lg ${v.featured ? "bg-[#2563EB]/25 text-[#93C5FD]" : "bg-white/[0.05] text-[#94A3B8] hover:text-white"}`}
                      title={v.featured ? "Remove from Featured" : "Feature in feed + library"}
                    >
                      <Star size={13} fill={v.featured ? "currentColor" : "none"} />
                    </button>
                    <button onClick={() => checkLink(v)} className="p-1.5 rounded-lg bg-white/[0.05] text-[#94A3B8] hover:text-white" title="Check YouTube link">
                      <RefreshCw size={13} className={busyId === v.id ? "animate-spin" : ""} />
                    </button>
                    {v.youtubeId && (
                      <a
                        href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white/[0.05] text-[#94A3B8] hover:text-white"
                        title="Open on YouTube"
                      >
                        <Link2 size={13} />
                      </a>
                    )}
                    <button onClick={() => remove(v)} className="p-1.5 rounded-lg bg-[#EF4444]/10 text-[#FCA5A5] hover:bg-[#EF4444]/20" title={t("common.delete")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ─── create / edit form (modal) ─── */}
      {showForm && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8">
          <div className="bg-[#151220] border border-white/[0.08] rounded-3xl w-full max-w-2xl my-auto">
            <div className="sticky top-0 bg-[#151220] rounded-t-3xl border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">
                {form.id ? t("admin.videos.edit") : t("admin.videos.add")}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full bg-white/[0.05] text-[#94A3B8] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* YouTube source */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  YouTube URL or video id *
                </label>
                <div className="flex gap-2">
                  <input
                    value={form.youtubeUrlOrId}
                    onChange={(e) => setForm((f) => ({ ...f, youtubeUrlOrId: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50"
                  />
                  <button
                    onClick={fetchMeta}
                    disabled={resolving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs font-bold text-white disabled:opacity-50"
                  >
                    {resolving ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Fetch
                  </button>
                </div>
                {resolved && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
                    {resolved.thumbnailUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolved.thumbnailUrl} alt="" className="w-20 h-12 object-cover rounded-lg" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{resolved.title || "(no title returned)"}</p>
                      <p className="text-[10px] text-[#94A3B8]">
                        {resolved.author || "YouTube"}
                        {resolved.embeddable ? " · embeddable" : " · embedding disabled"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* title */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2563EB]/50"
                />
              </div>

              {/* summary */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Short description (cards &amp; feed)
                </label>
                <input
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                  maxLength={300}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2563EB]/50"
                />
              </div>

              {/* description */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Full description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2563EB]/50 resize-y"
                />
              </div>

              {/* category + language + duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-[#13294A]"
                  >
                    {VIDEO_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Video language</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-[#13294A]"
                  >
                    {VIDEO_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.name} ({l.nativeLabel})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Duration (mm:ss)</label>
                  <input
                    value={form.durationInput}
                    onChange={(e) => setForm((f) => ({ ...f, durationInput: e.target.value }))}
                    placeholder="e.g. 12:45"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50"
                  />
                </div>
              </div>

              {/* subtitles + dubs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Available subtitles</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VIDEO_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => toggleLang("subtitles", l.code)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          form.subtitles.includes(l.code)
                            ? "bg-[#2563EB] border-[#2563EB] text-white"
                            : "bg-white/[0.03] border-white/[0.08] text-[#94A3B8]"
                        }`}
                      >
                        {l.nativeLabel}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Available dubs</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VIDEO_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => toggleLang("dubs", l.code)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          form.dubs.includes(l.code)
                            ? "bg-[#22D3EE] border-[#22D3EE] text-white"
                            : "bg-white/[0.03] border-white/[0.08] text-[#94A3B8]"
                        }`}
                      >
                        {l.nativeLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* bible refs */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                    <BookOpen size={12} className="text-[#2563EB]" /> Related Bible passages
                  </label>
                  <button
                    onClick={() => setForm((f) => ({ ...f, refs: [...f.refs, { bookId: "genesis", chapterStart: "1", verseStart: "", chapterEnd: "", verseEnd: "" }] }))}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#60A5FA] hover:text-white"
                  >
                    <Plus size={11} /> Add passage
                  </button>
                </div>
                {form.refs.length === 0 && (
                  <p className="text-[11px] text-[#64748B]">
                    Link the video to Bible books/chapters — it will appear in the reader's "Watch Related Videos" section, on matching comic pages, and in the Watch hub. For a whole-book movie use a chapter range (Genesis: from 1 to 50).
                  </p>
                )}
                <div className="space-y-2">
                  {form.refs.map((r, i) => {
                    const preview = refPreview(r);
                    return (
                      <div key={i}>
                        <div className="flex gap-1.5 items-center">
                          <select
                            value={r.bookId}
                            onChange={(e) => setRefRow(i, { bookId: e.target.value })}
                            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-2 text-xs text-white outline-none [&>option]:bg-[#13294A]"
                          >
                            {BIBLE_BOOKS.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <input
                            value={r.chapterStart}
                            onChange={(e) => setRefRow(i, { chapterStart: e.target.value })}
                            placeholder="From ch."
                            inputMode="numeric"
                            className="w-16 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-2 text-xs text-white outline-none"
                          />
                          <input
                            value={r.chapterEnd}
                            onChange={(e) => setRefRow(i, { chapterEnd: e.target.value })}
                            placeholder="to ch."
                            inputMode="numeric"
                            className="w-16 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-2 text-xs text-white outline-none"
                          />
                          <input
                            value={r.verseStart}
                            onChange={(e) => setRefRow(i, { verseStart: e.target.value })}
                            placeholder="v (opt.)"
                            inputMode="numeric"
                            className="w-16 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-2 text-xs text-white outline-none"
                          />
                          <button
                            onClick={() => setForm((f) => ({ ...f, refs: f.refs.filter((_, idx) => idx !== i) }))}
                            className="p-2 rounded-lg bg-[#EF4444]/10 text-[#FCA5A5]"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {preview && (
                          <p className={`mt-1 text-[10px] font-bold ${preview.tip ? "text-[#FBBF24]" : "text-[#60A5FA]"}`}>
                            Shows as “{preview.text}”{preview.tip ? ` — ${preview.tip}` : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* source / rights / warning / thumbnail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Source (channel/publisher)</label>
                  <input
                    value={form.sourceName}
                    onChange={(e) => setForm((f) => ({ ...f, sourceName: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2563EB]/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Rights / permission note</label>
                  <input
                    value={form.rightsNote}
                    onChange={(e) => setForm((f) => ({ ...f, rightsNote: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2563EB]/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Content warning (if needed)</label>
                  <input
                    value={form.contentWarning}
                    onChange={(e) => setForm((f) => ({ ...f, contentWarning: e.target.value }))}
                    placeholder="e.g. Depicts the crucifixion"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1.5">Custom thumbnail URL (optional)</label>
                  <input
                    value={form.thumbnailUrl}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                    placeholder="https://…"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#64748B] outline-none focus:border-[#2563EB]/50"
                  />
                </div>
              </div>

              {/* featured */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                  className="w-4 h-4 accent-[#2563EB]"
                />
                <span className="text-xs font-bold text-white">
                  Featured — show in the feed rail and the Featured Videos section
                </span>
              </label>

              {/* actions */}
              <div className="flex items-center gap-2.5 pt-2 border-t border-white/[0.06] flex-wrap">
                {form.id ? (
                  <>
                    <button
                      onClick={() => save(undefined)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold disabled:opacity-50"
                    >
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      Save Changes
                    </button>
                    {items.find((x) => x.id === form.id)?.status !== "published" && (
                      <button
                        onClick={() => save(true)}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-sm font-bold text-[#4ADE80] disabled:opacity-50"
                      >
                        Publish
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => save(true)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold disabled:opacity-50"
                    >
                      {saving && <Loader2 size={14} className="animate-spin" />}
                      Publish
                    </button>
                    <button
                      onClick={() => save(false)}
                      disabled={saving}
                      className="px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm font-bold text-white disabled:opacity-50"
                    >
                      Save as Draft
                    </button>
                  </>
                )}
                {form.id && (
                  <a
                    href={`/videos/${items.find((x) => x.id === form.id)?.slug || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs font-bold text-[#94A3B8] hover:text-white"
                  >
                    <ExternalLink size={12} /> Preview page
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
