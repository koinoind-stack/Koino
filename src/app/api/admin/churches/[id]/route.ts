import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHURCH_TYPES = ["Church", "Ministry", "Fellowship", "Prayer Hall", "Other"];

/**
 * PATCH /api/admin/churches/[id]
 * Admin-only — EDIT a listing's public information (fix wrong address,
 * times, contact details, etc. — this is the correction path for flagged
 * listings). Only provided fields are updated.
 *
 * Body (all optional): { name, description, denomination, type, state, city,
 *   address, postalCode, location, contactName, contactEmail, contactPhone,
 *   whatsappNumber, website, service_times, languages, images }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
    const { id } = await params;

    const existing = await db.church.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Church not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    const str = (v: unknown, max: number) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

    const name = str(body.name, 300);
    if (name !== undefined) data.name = name;
    const description = str(body.description, 5000);
    if (description !== undefined) data.description = description;
    const denomination = str(body.denomination, 200);
    if (denomination !== undefined) data.denomination = denomination;

    // Listing type — fixed set so the value stays filterable
    const rawType = typeof body.type === "string" ? body.type.trim() : "";
    if (rawType) {
      if (!CHURCH_TYPES.includes(rawType)) {
        return NextResponse.json(
          { error: `Invalid type. Allowed: ${CHURCH_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      data.type = rawType;
    }

    const state = str(body.state, 100);
    if (state !== undefined) data.state = state;
    const city = str(body.city, 100);
    if (city !== undefined) data.city = city;
    const address = str(body.address, 500);
    if (address !== undefined) data.address = address;
    const postalCode = str(body.postalCode, 20);
    if (postalCode !== undefined) data.postalCode = postalCode;
    const location = str(body.location, 500);
    if (location !== undefined) data.location = location;
    const contactName = str(body.contactName, 200);
    if (contactName !== undefined) data.contactName = contactName;
    const contactEmail = str(body.contactEmail, 200);
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    const contactPhone = str(body.contactPhone, 30);
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    const whatsappNumber = str(body.whatsappNumber, 30);
    if (whatsappNumber !== undefined) data.whatsappNumber = whatsappNumber;
    const website = str(body.website, 500);
    if (website !== undefined) data.website = website;

    if (Array.isArray(body.service_times)) {
      const rows = body.service_times
        .slice(0, 14)
        .map((s: any) => ({
          day: DAYS.includes(s?.day) ? s.day : "Sunday",
          time: typeof s?.time === "string" ? s.time.trim().slice(0, 120) : "",
          language: typeof s?.language === "string" ? s.language.trim().slice(0, 60) : "English",
        }))
        .filter((s: { time: string }) => s.time);
      data.serviceTimes = JSON.stringify(rows);
    }

    if (Array.isArray(body.languages)) {
      data.languages = JSON.stringify(
        body.languages
          .filter((l: any) => typeof l === "string" && l.trim())
          .map((l: string) => l.trim().slice(0, 60))
          .slice(0, 12)
      );
    }

    if (Array.isArray(body.images)) {
      const imgs = body.images
        .filter((i: any) => typeof i === "string" && i.trim())
        .slice(0, 5);
      data.coverImage = imgs[0] ? String(imgs[0]).slice(0, 1000) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.church.update({ where: { id }, data });

    try {
      revalidatePath("/", "layout");
    } catch {}

    console.log(`[api/admin/churches PATCH] Church ${id} edited by ${user.email}`);
    return NextResponse.json({ success: true, church: { id: updated.id } });
  } catch (err: any) {
    console.error("[api/admin/churches/id] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update church" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/churches/[id]
 * Admin-only — permanently deletes a church record.
 *
 * Use this for spam, abuse, or test churches. For moderation of legitimate
 * submissions, prefer REJECT or CANCEL instead of DELETE (those preserve
 * the audit trail).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing church id" }, { status: 400 });
    }

    const existing = await db.church.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Church not found" }, { status: 404 });
    }

    await db.church.delete({ where: { id } });

    console.log(`[api/admin/churches DELETE] Church ${id} deleted by ${user.email}`);

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/admin/churches DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete church" }, { status: 500 });
  }
}
