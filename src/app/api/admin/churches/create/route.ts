import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHURCH_TYPES = ["Church", "Ministry", "Fellowship", "Prayer Hall", "Other"];

/**
 * POST /api/admin/churches/create
 * Admin-only — CREATE a listing directly from the admin panel.
 *
 * Unlike the public POST /api/churches (always PENDING + rate limited +
 * duplicate-guarded per submitter), the admin decides the initial status:
 *   - status "PUBLISHED" (default) — visible immediately in the directory
 *   - status "PENDING" — queued like a user submission
 *
 * Optional ownerEmail attaches the listing to a REGISTERED user straight
 * away (the "rightful owner" flow — same lookup as the transfer action);
 * without it the listing belongs to the admin who created it.
 *
 * Body: { name*, description*, state*, city*, type?, denomination?,
 *   country?, address?, postalCode?, location?, contactName?, contactEmail?,
 *   contactPhone?, whatsappNumber?, website?, service_times?, languages?,
 *   images?, cover_gradient?, ownerEmail?, status? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // ─── Required fields (same bar as the public submission) ───
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Church name is required." }, { status: 400 });
    }
    if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }
    if (!body.city || !body.state) {
      return NextResponse.json({ error: "City and State are required." }, { status: 400 });
    }

    const status =
      body.status === "PENDING" ? "PENDING" : "PUBLISHED"; // admin default: PUBLISHED

    // ─── Optional rightful owner — must be a registered user ───
    let ownerId = user.id;
    let ownerEmail = user.email;
    const ownerEmailRaw = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : "";
    if (ownerEmailRaw) {
      const target = await db.user.findFirst({
        where: { email: { equals: ownerEmailRaw, mode: "insensitive" } },
        select: { id: true, email: true },
      });
      if (!target) {
        return NextResponse.json(
          {
            error: `No registered user found with email "${ownerEmailRaw}". Leave the field empty to keep the listing under your account, or ask them to sign up first.`,
          },
          { status: 404 }
        );
      }
      ownerId = target.id;
      ownerEmail = target.email;
    }

    // ─── Service times / languages / images — same validators as public POST ───
    const rawServices = Array.isArray(body.service_times) ? body.service_times : [];
    const serviceTimes = rawServices
      .slice(0, 14)
      .map((s: any) => ({
        day: DAYS.includes(s?.day) ? s.day : "Sunday",
        time: typeof s?.time === "string" ? s.time.trim().slice(0, 120) : "",
        language: typeof s?.language === "string" ? s.language.trim().slice(0, 60) : "English",
      }))
      .filter((s: { time: string }) => s.time);

    const languages = (Array.isArray(body.languages) ? body.languages : [])
      .filter((l: any) => typeof l === "string" && l.trim())
      .map((l: string) => l.trim().slice(0, 60))
      .slice(0, 12);

    const images = (Array.isArray(body.images) ? body.images : [])
      .filter((i: any) => typeof i === "string" && i.trim())
      .slice(0, 5);
    const coverImage =
      (typeof body.cover_image === "string" && body.cover_image.trim()) || images[0] || null;

    const rawType = typeof body.type === "string" ? body.type.trim() : "";
    const type = CHURCH_TYPES.includes(rawType) ? rawType : "Church";

    const locationParts = [body.address, body.city, body.state].filter(Boolean);
    const location = body.location?.trim() || locationParts.join(", ") || "Location not specified";

    const church = await db.church.create({
      data: {
        name: String(body.name).trim().slice(0, 300),
        description: String(body.description).trim().slice(0, 5000),
        denomination: body.denomination ? String(body.denomination).slice(0, 200) : "",
        type,
        country: body.country || "India",
        state: String(body.state).slice(0, 100),
        city: String(body.city).slice(0, 100),
        address: body.address ? String(body.address).slice(0, 500) : null,
        postalCode: body.postalCode ? String(body.postalCode).slice(0, 20) : null,
        location: location.slice(0, 500),
        contactName: body.contactName ? String(body.contactName).slice(0, 200) : null,
        contactEmail: body.contactEmail ? String(body.contactEmail).slice(0, 200) : null,
        contactPhone: body.contactPhone ? String(body.contactPhone).slice(0, 30) : null,
        whatsappNumber: body.whatsappNumber ? String(body.whatsappNumber).slice(0, 30) : null,
        website: body.website ? String(body.website).slice(0, 500) : null,
        serviceTimes: JSON.stringify(serviceTimes),
        languages: JSON.stringify(languages),
        coverImage: coverImage ? String(coverImage).slice(0, 1000) : null,
        coverGradient: typeof body.cover_gradient === "number" ? body.cover_gradient : Math.floor(Math.random() * 8),
        status,
        featured: false,
        createdById: ownerId,
        createdByEmail: ownerEmail,
        reviewedBy: user.email,
        reviewedAt: new Date(),
      },
    });

    console.log(
      `[api/admin/churches/create] Church ${church.id} created (status=${status}, owner=${ownerEmail}, by ${user.email})`
    );

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({
      success: true,
      churchId: church.id,
      status: church.status,
      ownerEmail,
    });
  } catch (error: any) {
    console.error("[api/admin/churches/create] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create church listing." },
      { status: 500 }
    );
  }
}
