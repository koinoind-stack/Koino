import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const db = new PrismaClient();

/**
 * GET /api/comic/share/[panelId]?lang=hi&format=square
 *
 * Generates a social-media-ready share card PNG image server-side.
 * Uses sharp to composite artwork + text overlays into a single PNG.
 *
 * Query params:
 *   lang — "en" (default), "hi", "te", etc.
 *   format — "square" (1080x1080) or "story" (1080x1920)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ panelId: string }> }
) {
  try {
    const { panelId } = await params;
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") || "en";
    const format = url.searchParams.get("format") || "square";

    const width = 1080;
    const height = format === "story" ? 1920 : 1080;

    const panel = await db.comicPanel.findUnique({
      where: { panelId },
      include: { translations: true, comicChapter: true },
    });

    if (!panel) {
      return NextResponse.json({ error: "Panel not found" }, { status: 404 });
    }

    const translation = panel.translations.find((t) => t.lang === lang) ||
                        panel.translations.find((t) => t.lang === "en");

    const title = translation?.title || "Koino Bible Comics";
    const narration = translation?.narration || "";
    const excerpt = narration.length > 200 ? narration.substring(0, 197) + "..." : narration;
    const bookName = panel.bookId.charAt(0).toUpperCase() + panel.bookId.slice(1);
    const verseRef = `${bookName} ${panel.chapter}:${panel.verseStart}-${panel.verseEnd}`;

    const escapeXml = (str: string) =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

    const wrapText = (text: string, maxChars: number): string[] => {
      const words = text.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + " " + word).length > maxChars) {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + " " + word : word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const titleLines = wrapText(escapeXml(title), 24);
    const excerptLines = wrapText(escapeXml(excerpt), 38);

    const overlayY = format === "story" ? height - 580 : height - 380;

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1"/>
          <stop offset="60%" style="stop-color:#16213e;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#0f0f1a;stop-opacity:1"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="35%" r="55%">
          <stop offset="0%" style="stop-color:#F39B9B;stop-opacity:0.15"/>
          <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect width="${width}" height="${height}" fill="url(#glow)"/>
      <text x="${width / 2}" y="70" text-anchor="middle" fill="#F39B9B" font-family="Georgia, serif" font-size="28" font-weight="bold">${escapeXml(verseRef)}</text>
      ${titleLines.map((line, i) => `<text x="${width / 2}" y="${130 + i * 56}" text-anchor="middle" fill="white" font-family="Georgia, serif" font-size="48" font-weight="bold">${line}</text>`).join("")}
      ${excerptLines.map((line, i) => `<text x="${width / 2}" y="${overlayY + 60 + i * 38}" text-anchor="middle" fill="#94A3B8" font-family="Arial, sans-serif" font-size="32">${line}</text>`).join("")}
      <rect x="${width / 2 - 90}" y="${height - 80}" width="180" height="44" rx="22" fill="#F39B9B"/>
      <text x="${width / 2}" y="${height - 52}" text-anchor="middle" fill="#0f0f1a" font-family="Arial, sans-serif" font-size="24" font-weight="bold">www.koino.in</text>
    </svg>`;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error: any) {
    console.error("[comic/share] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate share card" }, { status: 500 });
  }
}
