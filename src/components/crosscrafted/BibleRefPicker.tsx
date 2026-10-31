"use client";

// ─── BibleRefPicker — searchable Bible reference selector (PART 2) ──────────
//
// Reusable picker for attaching MULTIPLE validated Bible references to an
// article, question or answer. Backed by src/lib/bible-ref.ts:
//  - searchable across all 66 books (name / abbreviation / common aliases)
//  - chapter clamped to the book's real chapter count (Koino canon)
//  - verse range sanity checks, single-chapter-book convention (Jude 2)
//  - canonical display strings ("John 1:1–3") stored in the existing
//    bibleRefs JSON-array fields — no schema change for the picker itself.
//
// Does NOT fetch or store Bible text — public chips deep-link into the
// existing reader (/?view=bible&book=..&chapter=..&verse=..).

import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, Plus, Search, X } from "lucide-react";
import { BIBLE_BOOKS } from "@/lib/bible-data";
import { canonicalizeBibleRef } from "@/lib/bible-ref";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function BibleRefPicker({
  value,
  onChange,
  max = 20,
}: {
  value: string[]; // canonical display strings, e.g. ["John 1:1–3"]
  onChange: (refs: string[]) => void;
  max?: number;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [chapter, setChapter] = useState("");
  const [verseStart, setVerseStart] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedBook = useMemo(
    () => BIBLE_BOOKS.find((b) => b.id === selectedBookId) ?? null,
    [selectedBookId]
  );

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return BIBLE_BOOKS;
    // Search by name, abbreviation, or aliases handled by resolveBook —
    // for the list UI a simple name/abbr prefix filter is enough.
    return BIBLE_BOOKS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.abbr.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
    );
  }, [search]);

  const resetForm = () => {
    setSelectedBookId(null);
    setChapter("");
    setVerseStart("");
    setVerseEnd("");
    setError(null);
  };

  const addRef = () => {
    if (!selectedBook) return;
    const parts = [
      selectedBook.name,
      chapter.trim(),
      verseStart.trim() ? `:${verseStart.trim()}` : "",
      verseEnd.trim() ? `-${verseEnd.trim()}` : "",
    ];
    const input = parts.join(" ").replace(/\s+/g, " ").trim();
    const result = canonicalizeBibleRef(input);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (value.includes(result.canonical)) {
      setError(t("bibleRef.alreadyAttached", { ref: result.canonical }));
      return;
    }
    if (value.length >= max) {
      setError(t("bibleRef.maxRefs", { n: max }));
      return;
    }
    onChange([...value, result.canonical]);
    // Keep the same book selected so several refs from one book are quick.
    setChapter("");
    setVerseStart("");
    setVerseEnd("");
    setError(null);
  };

  const removeRef = (ref: string) => {
    onChange(value.filter((r) => r !== ref));
  };

  return (
    <div>
      {/* Attached refs as removable chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((ref) => (
            <span
              key={ref}
              className="inline-flex items-center gap-1 bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#38BDF8] text-[11px] font-semibold px-2 py-1 rounded-lg"
            >
              <BookOpen size={10} className="shrink-0" />
              {ref}
              <button
                type="button"
                onClick={() => removeRef(ref)}
                className="ml-0.5 text-[#38BDF8]/60 hover:text-white transition-colors"
                aria-label={t("bibleRef.removeRef", { ref })}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Toggle button / inline form */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={value.length >= max}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#A78BFA] hover:text-white bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 border border-[#7C3AED]/25 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={12} /> {t("bibleRef.addBibleRef")}
        </button>
      ) : (
        <div className="bg-black/20 border border-white/[0.08] rounded-xl p-3 space-y-2">
          {!selectedBook ? (
            <>
              {/* Book search */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("bibleRef.searchBooksPlaceholder")}
                  className="neo-input text-xs pl-7 py-1.5"
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1">
                {filteredBooks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBookId(b.id);
                      // Single-chapter books (Jude, Obadiah…): pre-fill chapter
                      // 1 so the Verse field works directly.
                      setChapter(b.chapters === 1 ? "1" : "");
                      setError(null);
                    }}
                    className="text-left text-[11px] px-2 py-1.5 rounded-lg bg-white/[0.03] hover:bg-[#7C3AED]/20 text-[#A09DB1] hover:text-white transition-colors truncate"
                    title={t("bibleRef.bookChapterCountTitle", { name: b.name, n: b.chapters })}
                  >
                    <span className="font-bold">{b.name}</span>
                    <span className="text-[#64748B] ml-1">{b.abbr}</span>
                  </button>
                ))}
                {filteredBooks.length === 0 && (
                  <p className="col-span-full text-[11px] text-[#64748B] py-2 text-center">
                    {t("bibleRef.noBookMatch", { q: search })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="text-[10px] font-bold text-[#64748B] hover:text-white transition-colors"
              >
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <>
              {/* Chapter + verses for the selected book */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-[#94A3B8] hover:text-white shrink-0"
                  aria-label={t("bibleRef.backToBooks")}
                >
                  <ChevronLeft size={12} />
                </button>
                <span className="text-[11px] font-bold text-white">{selectedBook.name}</span>
                <span className="text-[9px] text-[#64748B]">
                  {t("bibleRef.chapterCount", { n: selectedBook.chapters })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    {t("bibleRef.chapter")} {selectedBook.chapters > 1 && "*"}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={selectedBook.chapters}
                    value={chapter}
                    onChange={(e) => {
                      setChapter(e.target.value);
                      setError(null);
                    }}
                    placeholder={selectedBook.chapters > 1 ? `1–${selectedBook.chapters}` : "1"}
                    className="neo-input text-xs py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    {t("bibleRef.verseOptional")}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={verseStart}
                    onChange={(e) => {
                      setVerseStart(e.target.value);
                      setError(null);
                    }}
                    placeholder="—"
                    className="neo-input text-xs py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                    {t("bibleRef.toVerseOptional")}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={verseEnd}
                    onChange={(e) => {
                      setVerseEnd(e.target.value);
                      setError(null);
                    }}
                    placeholder="—"
                    disabled={!verseStart}
                    className="neo-input text-xs py-1.5 disabled:opacity-40"
                  />
                </div>
              </div>
              {error && (
                <p className="text-[10px] text-[#F39B9B] leading-relaxed">{error}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addRef}
                  className="inline-flex items-center gap-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[11px] font-bold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  disabled={!chapter.trim()}
                >
                  <Plus size={11} /> {t("bibleRef.addRef")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="text-[10px] font-bold text-[#64748B] hover:text-white transition-colors"
                >
                  {t("common.done")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
