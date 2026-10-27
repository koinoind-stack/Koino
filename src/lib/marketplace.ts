import "server-only";
import { MARKETPLACE_CATEGORIES, BUSINESS_CATEGORIES, INDIAN_STATES, getCitiesForState } from "@/lib/crosscrafted-data";

/**
 * Shared server helpers for the Marketplace / Koino Store / Business Directory
 * persistence upgrade. Conventions follow the audited codebase rules: manual
 * validation (no zod), JSON-string array columns, UPPERCASE directory
 * statuses, rate limiting after auth.
 */

export const MAX_LISTING_IMAGES = 5;
const MAX_IMAGE_CHARS = 700_000; // ~525 KB binary per canvas-compressed data URL
const MAX_IMAGES_TOTAL_CHARS = 3_000_000;

export type ValidatedImage = { ok: true; images: string[] } | { ok: false; error: string };

/** Images must be canvas-compressed data URLs (existing ImagePicker flow) or
 *  https URLs from our Supabase storage. Hard size caps protect the DB. */
export function validateImages(input: unknown, max = MAX_LISTING_IMAGES): ValidatedImage {
  if (input == null) return { ok: true, images: [] };
  if (!Array.isArray(input)) return { ok: false, error: "Invalid image data" };
  const imgs = input.filter((u): u is string => typeof u === "string").map((u) => u.trim());
  if (imgs.length > max) return { ok: false, error: `A maximum of ${max} images is allowed` };
  let total = 0;
  for (const img of imgs) {
    total += img.length;
    const isData = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img);
    const isHttps = /^https:\/\/.+/.test(img);
    if (!isData && !isHttps) return { ok: false, error: "Images must be uploaded through Koino's uploader" };
    if (img.length > MAX_IMAGE_CHARS) return { ok: false, error: "One of the images is too large — please use a smaller photo" };
  }
  if (total > MAX_IMAGES_TOTAL_CHARS) return { ok: false, error: "The photos together are too large — please use fewer or smaller images" };
  return { ok: true, images: imgs };
}

export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export function int(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

export const INR_MAX = 10_000_000;

export function validPrice(price: number, mrp: number | null): string | null {
  if (price < 1 || price > INR_MAX) return "Please enter a valid price in ₹ (1 – 1,00,00,000)";
  if (mrp != null && (mrp < 1 || mrp > INR_MAX)) return "Please enter a valid MRP";
  if (mrp != null && mrp < price) return "MRP cannot be lower than the selling price";
  return null;
}

export const PHONE_RE = /^\+?[0-9]{10,15}$/;
export function validPhone(v: string | null): boolean {
  return v == null || PHONE_RE.test(v.replace(/[\s\-()]/g, ""));
}

export function validCategory(cat: string, kind: "marketplace" | "business"): boolean {
  const list = kind === "marketplace" ? MARKETPLACE_CATEGORIES : BUSINESS_CATEGORIES;
  return (list as readonly string[]).includes(cat);
}

export function validLocation(state: string | null, city: string | null): string | null {
  if (state && !INDIAN_STATES.includes(state)) return "Please choose a valid state";
  if (city && state && !getCitiesForState(state).includes(city)) return "Please choose a valid city for the selected state";
  return null;
}

export function validWebsite(v: string | null): boolean {
  return v == null || /^https:\/\/[^\s]+\.[^\s]+/.test(v);
}

export function validEmail(v: string | null): boolean {
  return v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Safe-parse a JSON string column into a string[] (codebase convention). */
export function safeParseArray(json: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Cover image: first image or null (UI falls back to coverGradient). */
export function coverOf(images: string[]): string | null {
  return images[0] || null;
}

// ─── Card shapes shared with the existing UI types ─────────────────────────

export type PublicProductCard = {
  id: string;
  kind: "member" | "koino";
  name: string;
  description: string;
  price: number;
  mrp: number | null;
  category: string;
  subcategory: string | null;
  vendor: string;
  sellerType: "marketplace" | "believ";
  state: string;
  city: string;
  rating: null;
  reviews: null;
  cover_gradient: number;
  cover_image: string | null;
  images: string[];
  in_stock: boolean;
  featured: boolean;
  buyUrl: string | null;
  createdAt: string;
};

/** Public list shape — NEVER includes seller contact details. */
export function serializeMemberListing(row: {
  id: string; title: string; description: string; price: number; mrp: number | null;
  category: string; images: string; state: string | null; city: string | null;
  sellerName: string; inStock: boolean; featured: boolean; coverGradient: number;
  createdAt: Date; sellerType: string;
}): PublicProductCard {
  const images = safeParseArray(row.images);
  return {
    id: row.id,
    kind: "member",
    name: row.title,
    description: row.description,
    price: row.price,
    mrp: row.mrp,
    category: row.category,
    subcategory: null,
    vendor: row.sellerName,
    sellerType: "marketplace",
    state: row.state || "",
    city: row.city || "",
    rating: null,
    reviews: null,
    cover_gradient: row.coverGradient,
    cover_image: coverOf(images),
    images,
    in_stock: row.inStock,
    featured: row.featured,
    buyUrl: null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeStoreProduct(row: {
  id: string; name: string; description: string; price: number; mrp: number | null;
  category: string; images: string; featured: boolean; coverGradient: number;
  inStock: boolean; stockQuantity: number; buyUrl: string | null; createdAt: Date;
}): PublicProductCard {
  const images = safeParseArray(row.images);
  return {
    id: row.id,
    kind: "koino",
    name: row.name,
    description: row.description,
    price: row.price,
    mrp: row.mrp,
    category: row.category,
    subcategory: null,
    vendor: "Koino Store",
    sellerType: "believ",
    state: "",
    city: "",
    rating: null,
    reviews: null,
    cover_gradient: row.coverGradient,
    cover_image: coverOf(images),
    images,
    in_stock: row.inStock && row.stockQuantity > 0,
    featured: row.featured,
    buyUrl: row.buyUrl,
    createdAt: row.createdAt.toISOString(),
  };
}
