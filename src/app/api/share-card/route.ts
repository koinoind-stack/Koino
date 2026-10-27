import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { rateLimit } from "@/lib/social/rate-limit";
import {
  renderShareCard,
  isCardFormat,
  isKoinoHostedImage,
  type CardFormat,
} from "@/lib/share/card-renderer";
import { db } from "@/lib/db";
import { safeParseArray } from "@/lib/marketplace";

/**
 * ─── UNIVERSAL SHARE-CARD API (Task 121) ─────────────────────────────────────
 *
 * GET /api/share-card?type=<type>&format=<square|portrait|story|landscape>&…
 *
 * The ONE image generator behind every Koino share. Rendered server-side by
 * src/lib/share/card-renderer.ts (SVG → sharp → PNG).
 *
 * PRIVACY / VISIBILITY GATES (enforced here, server-authoritative):
 *  • comic-panel / comic-chapter → chapter must be status="published" + active
 *  • post      → Post.published must be true; group posts require a public group
 *  • video     → Video.status must be "published"
 *  • article   → apologetics: KoinoArticle published; blog: BlogPost published+scheduled
 *  • event     → Event.status = "PUBLISHED" and (no group OR public group event)
 *  • group     → Group.visibility must be "public"
 *  • memorial  → status "published" AND visibility "public"
 *  • trivia    → requires an authenticated session; renders ONLY the caller's
 *                own real session numbers (never another user's)
 *  • prayer    → requires an authenticated session; renders the caller's own
 *                text as a branded card (the prayer wall has no public URLs,
 *                so no link is ever attached)
 *  • verse     → public-domain Bible text (bible-api.com); clamped excerpts
 *  • product / business → only status "published" / "approved" mock listings
 *
 * Unpublished, private, moderated or non-existent content → 403/404 JSON —
 * the client ShareSheet degrades to text-only sharing in that case.
 *
 * Caching: public cards are CDN-cacheable for an hour (Vercel edge), keeping
 * server generation costs controlled; user-specific cards are private.
 */

export const dynamic = "force-dynamic";

/* ─── verse text via bible-api.com (public domain), cached ──────────────── */

type ApiVerse = { verse: number; text: string };
type ApiVerseResult = { verses: ApiVerse[]; bookName: string | null };
const verseCache = new Map<string, ApiVerseResult>();
const VERSE_CACHE_MAX = 300;

async function fetchVerses(
  bookId: string,
  chapter: number,
  vs: number,
  ve: number,
  translation: string
): Promise<ApiVerseResult | null> {
  const key = `${bookId}/${chapter}/${vs}-${ve}/${translation}`;
  const hit = verseCache.get(key);
  if (hit) return hit;
  const ref = encodeURIComponent(`${bookId} ${chapter}:${vs}-${ve}`);
  try {
    const res = await fetch(
      `https://bible-api.com/${ref}?translation=${translation}`,
      { signal: AbortSignal.timeout(9000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const verses: ApiVerse[] = (data.verses || []).map((v: ApiVerse) => ({
      verse: v.verse,
      text: String(v.text || "").replace(/\s+/g, " ").trim(),
    }));
    if (!verses.length) return null;
    const out: ApiVerseResult = {
      verses,
      bookName: typeof data.book_name === "string" ? data.book_name : null,
    };
    if (verseCache.size >= VERSE_CACHE_MAX) {
      const first = verseCache.keys().next().value;
      if (first) verseCache.delete(first);
    }
    verseCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

const BOOK_NAME_RE = /^[a-z0-9_]{2,20}$/;

/* ─── handler ───────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (k: string) => (url.searchParams.get(k) || "").trim();
    const type = q("type");
    const formatParam = q("format") || "square";
    if (!isCardFormat(formatParam)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    const format = formatParam as CardFormat;
    const lang = q("lang") || "en";

    // Per-IP abuse guard (CDN caching absorbs most legitimate repeat traffic).
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!rateLimit(`sharecard:${ip}`, 120, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let spec: Parameters<typeof renderShareCard>[0] | null = null;

    switch (type) {
      /* ── Bible verse ── */
      case "verse": {
        const book = q("book").toLowerCase();
        const chapter = parseInt(q("chapter"), 10);
        const vs = parseInt(q("vs"), 10);
        const veRaw = parseInt(q("ve"), 10) || vs;
        const translation = q("translation") === "web" ? "web" : "kjv";
        if (
          !BOOK_NAME_RE.test(book) ||
          !Number.isFinite(chapter) || chapter < 1 || chapter > 200 ||
          !Number.isFinite(vs) || vs < 1 || vs > 200 ||
          veRaw < vs || veRaw - vs > 200
        ) {
          return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
        }
        const result = await fetchVerses(book, chapter, vs, veRaw, translation);
        if (!result) {
          return NextResponse.json({ error: "Verse text unavailable" }, { status: 404 });
        }
        // Reasonable selection only: clamp long passages on the IMAGE.
        const MAX_CARD_VERSES = 8;
        const shown = result.verses.slice(0, MAX_CARD_VERSES);
        const omitted = result.verses.length - shown.length;
        let body = shown.map((v) => `${v.verse} ${v.text}`).join(" ");
        if (omitted > 0) body += ` … ${omitted} more verse${omitted > 1 ? "s" : ""} — read the full passage on koino.in`;
        if (body.length > 900) body = body.slice(0, 897).replace(/\s+\S*$/, "") + "…";
        const refLabel =
          vs === veRaw ? `${chapter}:${vs}` : `${chapter}:${vs}-${veRaw}`;
        const displayBook =
          result.bookName || BOOK_NAMES[book] || book.charAt(0).toUpperCase() + book.slice(1);
        spec = {
          format,
          kicker: `Bible Verse • ${translation.toUpperCase()}`,
          title: `${displayBook} ${refLabel}`,
          body,
          gradientSeed: 1,
        };
        break;
      }

      /* ── Comic panel ── */
      case "comic-panel": {
        const panelId = q("panel");
        if (!panelId || panelId.length > 40) {
          return NextResponse.json({ error: "Invalid panel" }, { status: 400 });
        }
        const panel = await db.comicPanel.findUnique({
          where: { panelId },
          include: { translations: true, comicChapter: true },
        });
        if (!panel || panel.comicChapter.status !== "published" || !panel.comicChapter.isActive) {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        const t =
          panel.translations.find((x) => x.lang === lang) ||
          panel.translations.find((x) => x.lang === "en");
        const bookName =
          bookDisplayName(panel.bookId) ||
          panel.bookId.charAt(0).toUpperCase() + panel.bookId.slice(1);
        const narration = (t?.narration || "").trim();
        const verseRef =
          panel.verseStart === panel.verseEnd
            ? `${bookName} ${panel.chapter}:${panel.verseStart}`
            : `${bookName} ${panel.chapter}:${panel.verseStart}-${panel.verseEnd}`;
        spec = {
          format,
          kicker: `Bible Comics • ${bookName} ${panel.chapter}`,
          title: t?.title || `${bookName} ${panel.chapter}`,
          body: narration || undefined,
          reference: verseRef,
          bgImageUrl: panel.artworkUrl,
          bgIsKoinoHosted: isKoinoHostedImage(panel.artworkUrl),
          gradientSeed: 0,
        };
        break;
      }

      /* ── Comic chapter (cover card) ── */
      case "comic-chapter": {
        const book = q("book").toLowerCase();
        const chapter = parseInt(q("chapter"), 10);
        if (!BOOK_NAME_RE.test(book) || !Number.isFinite(chapter) || chapter < 1) {
          return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
        }
        const ch = await db.comicChapter.findFirst({
          where: { bookId: book, chapter, status: "published", isActive: true },
          include: { translations: true },
        });
        if (!ch) {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        const t =
          ch.translations.find((x) => x.lang === lang) ||
          ch.translations.find((x) => x.lang === "en");
        const bookName = bookDisplayName(book) || book.charAt(0).toUpperCase() + book.slice(1);
        spec = {
          format,
          kicker: "Bible Comics",
          title: t?.title || `${bookName} ${chapter}`,
          body: ch.description || `Read the story. See the bigger picture. Grow in your faith.`,
          reference: `${bookName} ${chapter}`,
          bgImageUrl: ch.coverArtUrl,
          bgIsKoinoHosted: isKoinoHostedImage(ch.coverArtUrl),
          gradientSeed: 0,
        };
        break;
      }

      /* ── Community post / reel ── */
      case "post": {
        const id = q("id");
        if (!id || id.length > 40) {
          return NextResponse.json({ error: "Invalid post" }, { status: 400 });
        }
        const post = await db.post.findUnique({
          where: { id },
          include: {
            author: { select: { name: true, username: true } },
            group: { select: { visibility: true, name: true } },
          },
        });
        if (!post || !post.published) {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        if (post.group && post.group.visibility !== "public") {
          return NextResponse.json({ error: "Private group content" }, { status: 403 });
        }
        let firstImage: string | null = null;
        try {
          const urls = JSON.parse(post.mediaUrls || "[]");
          if (Array.isArray(urls) && typeof urls[0] === "string") firstImage = urls[0];
        } catch { /* ignore malformed media */ }
        spec = {
          format,
          kicker: "Koino Community",
          title: post.title?.trim() || `${post.author.name || post.author.username || "A member"} shared:`,
          body: (post.content || "").trim() || undefined,
          reference: post.author.username ? `@${post.author.username}` : undefined,
          bgImageUrl: firstImage,
          bgIsKoinoHosted: isKoinoHostedImage(firstImage),
          gradientSeed: 2,
        };
        break;
      }

      /* ── Video (Watch) ──
         YouTube thumbnails are third-party media — never composited under
         Koino branding; the branded gradient + real title/channel is used. */
      case "video": {
        const slug = q("slug");
        if (!slug || slug.length > 120) {
          return NextResponse.json({ error: "Invalid video" }, { status: 400 });
        }
        const video = await db.video.findUnique({ where: { slug } });
        if (!video || video.status !== "published") {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        spec = {
          format,
          kicker: "Watch • Koino",
          title: video.title,
          body: video.description || undefined,
          reference: [video.sourceName, video.category].filter(Boolean).join(" • ") || undefined,
          gradientSeed: 2,
        };
        break;
      }

      /* ── Articles (apologetics / blog) ── */
      case "article": {
        const slug = q("slug");
        const kind = q("kind") === "blog" ? "blog" : "apologetics";
        if (!slug || slug.length > 160) {
          return NextResponse.json({ error: "Invalid article" }, { status: 400 });
        }
        if (kind === "blog") {
          const post = await db.blogPost.findUnique({ where: { slug } });
          const visible =
            post &&
            post.published &&
            (!post.scheduledAt || post.scheduledAt.getTime() <= Date.now());
          if (!visible) {
            return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
          }
          spec = {
            format,
            kicker: post!.category ? `Koino Blog • ${post!.category}` : "Koino Blog",
            title: post!.seoTitle || post!.title,
            body: post!.excerpt || post!.seoDescription || undefined,
            reference: post!.author || undefined,
            bgImageUrl: post!.featuredImage,
            bgIsKoinoHosted: isKoinoHostedImage(post!.featuredImage),
            gradientSeed: 1,
          };
        } else {
          const article = await db.koinoArticle.findUnique({ where: { slug } });
          if (!article || article.status !== "published" || article.contentType !== "APOLOGETICS") {
            return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
          }
          spec = {
            format,
            kicker: article.category ? `Apologetics • ${article.category}` : "Apologetics",
            title: article.seoTitle || article.title,
            body: article.excerpt || article.shortAnswer || undefined,
            reference: article.authorName || undefined,
            bgImageUrl: article.coverImageUrl,
            bgIsKoinoHosted: isKoinoHostedImage(article.coverImageUrl),
            gradientSeed: 1,
          };
        }
        break;
      }

      /* ── Event ── */
      case "event": {
        const id = q("id");
        if (!id || id.length > 40) {
          return NextResponse.json({ error: "Invalid event" }, { status: 400 });
        }
        const event = await db.event.findUnique({
          where: { id },
          select: {
            title: true, description: true, startDate: true, startTime: true,
            allDay: true, location: true, venueName: true, city: true, state: true,
            eventType: true, isOnline: true, status: true, groupId: true,
            groupVisibility: true, coverImage: true,
          },
        });
        if (!event || event.status !== "PUBLISHED") {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        if (event.groupId && event.groupVisibility !== "public") {
          return NextResponse.json({ error: "Private group event" }, { status: 403 });
        }
        const when = event.startDate.toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric",
        });
        const time = event.allDay ? "All day" : event.startTime || "";
        const where = event.isOnline
          ? "Online"
          : [event.venueName || event.location, event.city].filter(Boolean).join(", ");
        spec = {
          format,
          kicker: event.isOnline ? "Online Event" : "Event",
          title: event.title,
          body: [when + (time ? ` • ${time}` : ""), where].filter(Boolean).join("\n"),
          reference: event.city ? [event.city, event.state].filter(Boolean).join(", ") : undefined,
          bgImageUrl: event.coverImage,
          bgIsKoinoHosted: isKoinoHostedImage(event.coverImage),
          gradientSeed: 1,
        };
        break;
      }

      /* ── Group (public invitations only) ── */
      case "group": {
        const id = q("id");
        if (!id || id.length > 40) {
          return NextResponse.json({ error: "Invalid group" }, { status: 400 });
        }
        const group = await db.group.findUnique({
          where: { id },
          include: { _count: { select: { members: true } } },
        });
        if (!group || group.visibility !== "public") {
          return NextResponse.json({ error: "Private group" }, { status: 403 });
        }
        spec = {
          format,
          kicker: "Koino Group",
          title: group.name,
          body: group.description || undefined,
          reference: [
            `${group._count.members} member${group._count.members === 1 ? "" : "s"}`,
            group.city,
          ]
            .filter(Boolean)
            .join(" • "),
          bgImageUrl: group.coverImage || group.logoUrl,
          bgIsKoinoHosted: isKoinoHostedImage(group.coverImage || group.logoUrl),
          gradientSeed: 3,
        };
        break;
      }

      /* ── Memorial (public + published only) ── */
      case "memorial": {
        const id = q("id");
        if (!id || id.length > 40) {
          return NextResponse.json({ error: "Invalid memorial" }, { status: 400 });
        }
        const memorial = await db.memorial.findUnique({ where: { id } });
        if (!memorial || memorial.status !== "published" || memorial.visibility !== "public") {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        const years =
          memorial.dob && memorial.dod
            ? `${memorial.dob.getFullYear()} – ${memorial.dod.getFullYear()}`
            : memorial.dod
              ? memorial.dod.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : undefined;
        spec = {
          format,
          kicker: "In Loving Memory",
          title: memorial.fullName,
          body: memorial.tribute || memorial.verse || undefined,
          reference: memorial.verseRef || years,
          bgImageUrl: memorial.photoUrl,
          bgIsKoinoHosted: isKoinoHostedImage(memorial.photoUrl),
          gradientSeed: 3,
        };
        break;
      }

      /* ── Trivia session result (caller's OWN numbers only) ── */
      case "trivia": {
        const user = await getAuthUser();
        if (!user) {
          return NextResponse.json({ error: "Sign in to share your results" }, { status: 401 });
        }
        const sessionId = q("session");
        if (!sessionId || sessionId.length > 40) {
          return NextResponse.json({ error: "Invalid session" }, { status: 400 });
        }
        const session = await db.triviaQuizSession.findUnique({ where: { id: sessionId } });
        if (!session || session.userId !== user.id) {
          return NextResponse.json({ error: "Not your quiz session" }, { status: 403 });
        }
        spec = {
          format,
          kicker: "Bible Trivia",
          title: `${session.correctCount}/${session.totalQuestions} correct`,
          body:
            session.mode === "EARN_POINTS"
              ? `I earned ${session.score} Faith Points on Koino Bible Trivia! Can you beat me?`
              : `Practice session on Koino Bible Trivia. Come play with me!`,
          reference: `Total: ${user.totalPoints} Faith Points`,
          gradientSeed: 4,
        };
        break;
      }

      /* ── Church directory (public listing — name + location card) ── */
      case "church": {
        const id = q("id");
        if (!id || id.length > 40) {
          return NextResponse.json({ error: "Invalid church" }, { status: 400 });
        }
        const church = await db.church.findUnique({
          where: { id },
          select: {
            name: true, denomination: true, city: true, state: true,
            location: true, serviceTimes: true, coverImage: true, status: true, verified: true,
          },
        });
        if (!church || church.status !== "PUBLISHED") {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        let firstService = "";
        try {
          const rows: Array<{ day?: string; time?: string }> = JSON.parse(church.serviceTimes || "[]");
          const s = rows[0];
          if (s?.day) firstService = `${s.day}${s.time ? ` ${s.time}` : ""}`;
        } catch {}
        spec = {
          format,
          kicker: church.verified ? "Verified Church" : "Church",
          title: church.name,
          body: [
            church.denomination || "Church",
            [church.location || church.city, church.city].filter(Boolean).join(", "),
            firstService,
          ]
            .filter(Boolean)
            .join("\n"),
          reference: [church.city, church.state].filter(Boolean).join(", ") || undefined,
          bgImageUrl: church.coverImage,
          bgIsKoinoHosted: isKoinoHostedImage(church.coverImage),
          gradientSeed: 2,
        };
        break;
      }

      /* ── Prayer wall (own text only, no public URL exists) ── */
      case "prayer": {
        const user = await getAuthUser();
        if (!user) {
          return NextResponse.json(
            { error: "Sign in to share a prayer card" },
            { status: 401 }
          );
        }
        const title = q("title").slice(0, 120);
        const body = q("body").slice(0, 600);
        const category = q("category").slice(0, 40);
        if (!title) {
          return NextResponse.json({ error: "Missing prayer text" }, { status: 400 });
        }
        spec = {
          format,
          kicker: category ? `Prayer Wall • ${category}` : "Prayer Wall",
          title,
          body: body || undefined,
          reference: undefined,
          gradientSeed: 4,
        };
        break;
      }

      /* ── Marketplace product (approved member listing or store product) ── */
      case "product": {
        const id = q("id");
        const listing = await db.marketplaceListing.findUnique({ where: { id } });
        const storeProduct = listing ? null : await db.storeProduct.findUnique({ where: { id } });
        if (listing && listing.status !== "APPROVED") {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        const product = listing
          ? {
              name: listing.title,
              description: listing.description,
              price: listing.price,
              vendor: listing.sellerName,
              images: safeParseArray(listing.images),
            }
          : storeProduct && storeProduct.active
          ? {
              name: storeProduct.name,
              description: storeProduct.description,
              price: storeProduct.price,
              vendor: "Koino Store",
              images: safeParseArray(storeProduct.images),
            }
          : null;
        if (!product) {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        const price = `₹${product.price.toLocaleString("en-IN")}`;
        spec = {
          format,
          kicker: "Koino Marketplace",
          title: product.name,
          body: product.description || undefined,
          reference: `${price}${product.vendor ? ` • ${product.vendor}` : ""}`,
          bgImageUrl: product.images[0],
          bgIsKoinoHostedImage: isKoinoHostedImage(product.images[0]),
          gradientSeed: 1,
        };
        break;
      }

        break;
      }

      /* ── Business directory (approved DB listings only) ── */
      case "business": {
        const id = q("id");
        const business = await db.business.findUnique({ where: { id } });
        if (!business || business.status !== "APPROVED") {
          return NextResponse.json({ error: "Not available for sharing" }, { status: 404 });
        }
        const images = safeParseArray(business.images);
        spec = {
          format,
          kicker: "Christian Business Directory",
          title: business.name,
          body: business.description || undefined,
          reference: [business.category, business.city].filter(Boolean).join(" • "),
          bgImageUrl: images[0],
          bgIsKoinoHosted: isKoinoHostedImage(images[0]),
          gradientSeed: 2,
        };
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown card type" }, { status: 400 });
    }

    const png = await renderShareCard(spec);
    const isUserScoped = type === "trivia" || type === "prayer";
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": isUserScoped
          ? "private, max-age=120"
          : "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate share card";
    console.error("[share-card] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── Book name helper (canonical names for comic refs) ─────────────────── */

const BOOK_NAMES: Record<string, string> = {
  genesis: "Genesis", exodus: "Exodus", leviticus: "Leviticus", numbers: "Numbers",
  deuteronomy: "Deuteronomy", joshua: "Joshua", judges: "Judges", ruth: "Ruth",
  "1samuel": "1 Samuel", "2samuel": "2 Samuel", "1kings": "1 Kings", "2kings": "2 Kings",
  "1chronicles": "1 Chronicles", "2chronicles": "2 Chronicles", ezra: "Ezra",
  nehemiah: "Nehemiah", esther: "Esther", job: "Job", psalms: "Psalms", psalm: "Psalm",
  proverbs: "Proverbs", ecclesiastes: "Ecclesiastes", song_of_solomon: "Song of Solomon",
  isaiah: "Isaiah", jeremiah: "Jeremiah", lamentations: "Lamentations", ezekiel: "Ezekiel",
  daniel: "Daniel", hosea: "Hosea", joel: "Joel", amos: "Amos", obadiah: "Obadiah",
  jonah: "Jonah", micah: "Micah", nahum: "Nahum", habakkuk: "Habakkuk",
  zephaniah: "Zephaniah", haggai: "Haggai", zechariah: "Zechariah", malachi: "Malachi",
  matthew: "Matthew", mark: "Mark", luke: "Luke", john: "John", acts: "Acts",
  romans: "Romans", "1corinthians": "1 Corinthians", "2corinthians": "2 Corinthians",
  galatians: "Galatians", ephesians: "Ephesians", philippians: "Philippians",
  colossians: "Colossians", "1thessalonians": "1 Thessalonians",
  "2thessalonians": "2 Thessalonians", "1timothy": "1 Timothy", "2timothy": "2 Timothy",
  titus: "Titus", philemon: "Philemon", hebrews: "Hebrews", james: "James",
  "1peter": "1 Peter", "2peter": "2 Peter", "1john": "1 John", "2john": "2 John",
  "3john": "3 John", jude: "Jude", revelation: "Revelation",
};

function bookDisplayName(bookId: string): string | null {
  return BOOK_NAMES[bookId] || null;
}
