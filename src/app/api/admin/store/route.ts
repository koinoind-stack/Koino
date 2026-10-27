import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { validateImages, str, int, validPrice, validCategory } from "@/lib/marketplace";

/**
 * Admin: Koino Store inventory management. Admin-only — store products live
 * in their own table with no member relation, so members can never edit them.
 *
 * GET    /api/admin/store?q=&includeInactive=1 — full inventory incl. archived
 * POST   /api/admin/store — create product
 * PUT    /api/admin/store — partial update { id, ...fields } (archive =
 *        active:false, feature = featured:true, absolute stockQuantity)
 * DELETE /api/admin/store?id= — permanent delete
 */

async function requireAdmin(): Promise<string | null> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user.id;
}

function validateProductBody(body: Record<string, unknown>, partial: boolean): { data: Record<string, unknown> } | { error: string; status: number } {
  const data: Record<string, unknown> = {};

  if (!partial || body.name != null) {
    const name = str(body.name, 120);
    if (!name || name.length < 2) return { error: "Please enter the product name (2–120 characters)", status: 400 };
    data.name = name;
  }
  if (!partial || body.description != null) {
    const d = str(body.description, 5000);
    if (!d || d.length < 10) return { error: "Please write a short description (at least 10 characters)", status: 400 };
    data.description = d;
  }
  if (!partial || body.price != null) {
    const price = int(body.price);
    if (price == null) return { error: "Please enter the selling price in ₹", status: 400 };
    const mrp = body.mrp == null || body.mrp === "" ? null : int(body.mrp);
    const priceErr = validPrice(price, mrp);
    if (priceErr) return { error: priceErr, status: 400 };
    data.price = price;
    data.mrp = mrp;
  } else if (body.mrp !== undefined) {
    data.mrp = body.mrp == null || body.mrp === "" ? null : int(body.mrp);
    if (data.mrp != null && ((data.mrp as number) < 1 || (data.mrp as number) > 10_000_000)) {
      return { error: "Please enter a valid MRP", status: 400 };
    }
  }
  if (!partial || body.category != null) {
    const c = str(body.category, 60);
    if (!c || !validCategory(c, "marketplace")) return { error: "Please choose a valid category", status: 400 };
    data.category = c;
  }
  if (body.images !== undefined) {
    const imgs = validateImages(body.images);
    if (!imgs.ok) return { error: imgs.error, status: 400 };
    data.images = JSON.stringify(imgs.images);
  }
  if (body.stockQuantity !== undefined) {
    const sq = int(body.stockQuantity);
    if (sq == null || sq < 0 || sq > 1_000_000) return { error: "Stock quantity must be 0 or more", status: 400 };
    data.stockQuantity = sq;
  }
  if (body.inStock !== undefined) data.inStock = body.inStock === true;
  if (body.featured !== undefined) data.featured = body.featured === true;
  if (body.active !== undefined) data.active = body.active === true;
  if (body.buyUrl !== undefined) {
    const b = str(body.buyUrl, 600);
    if (b && !/^https:\/\/[^\s]+\.[^\s]+/.test(b)) return { error: "Buy URL must be a valid https link", status: 400 };
    data.buyUrl = b;
  }
  if (body.contactWhatsapp !== undefined) {
    const w = str(body.contactWhatsapp, 16)?.replace(/[\s\-()]/g, "") || null;
    if (w && !/^\+?[0-9]{10,15}$/.test(w)) return { error: "Invalid WhatsApp number", status: 400 };
    data.contactWhatsapp = w;
  }
  if (body.variations !== undefined) {
    // [{ name, options: string[] }] — normalized like /api/admin/gifts
    let vars: { name: string; options: string[] }[] = [];
    if (typeof body.variations === "string" && body.variations.trim()) {
      try { vars = JSON.parse(body.variations); } catch { return { error: "Invalid variations data", status: 400 }; }
    } else if (Array.isArray(body.variations)) {
      vars = body.variations as { name: string; options: string[] }[];
    }
    vars = vars
      .filter((v) => v && typeof v.name === "string" && v.name.trim() && Array.isArray(v.options))
      .slice(0, 6)
      .map((v) => ({ name: v.name.trim().slice(0, 40), options: v.options.filter((o) => typeof o === "string" && o.trim()).slice(0, 20).map((o) => o.trim().slice(0, 60)) }))
      .filter((v) => v.options.length > 0);
    data.variations = JSON.stringify(vars);
  }
  if (body.attributes !== undefined) {
    let attrs: { label: string; value: string }[] = [];
    if (typeof body.attributes === "string" && body.attributes.trim()) {
      try { attrs = JSON.parse(body.attributes); } catch { return { error: "Invalid attributes data", status: 400 }; }
    } else if (Array.isArray(body.attributes)) {
      attrs = body.attributes as { label: string; value: string }[];
    }
    attrs = attrs
      .filter((a) => a && typeof a.label === "string" && typeof a.value === "string" && a.label.trim() && a.value.trim())
      .slice(0, 10)
      .map((a) => ({ label: a.label.trim().slice(0, 40), value: a.value.trim().slice(0, 120) }));
    data.attributes = JSON.stringify(attrs);
  }

  return { data };
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const where: Record<string, unknown> = {};
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }];
    const rows = await db.storeProduct.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ products: rows, total: rows.length });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return NextResponse.json({ products: [], total: 0 });
    console.error("[admin/store] list failed:", err);
    return NextResponse.json({ error: "Could not load store products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const result = validateProductBody(body as Record<string, unknown>, false);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const row = await db.storeProduct.create({ data: result.data as any, select: { id: true, name: true } });
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, product: row }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return NextResponse.json({ error: "The store tables need to be created first" }, { status: 503 });
    console.error("[admin/store] create failed:", err);
    return NextResponse.json({ error: "Could not create the product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const result = validateProductBody(body as Record<string, unknown>, true);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    if (Object.keys(result.data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    const row = await db.storeProduct.update({ where: { id }, data: result.data, select: { id: true, name: true, active: true } });
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, product: row });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    console.error("[admin/store] update failed:", err);
    return NextResponse.json({ error: "Could not update the product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  try {
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await db.storeProduct.delete({ where: { id } });
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "Product not found" }, { status: 404 });
    console.error("[admin/store] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the product" }, { status: 500 });
  }
}
