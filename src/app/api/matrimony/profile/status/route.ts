import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireMatrimonyMember,
  logMatrimonyAudit,
  serializeMatrimonyProfile,
  matrimonyProfileInclude,
} from "@/lib/matrimony/server";

/**
 * ─── /api/matrimony/profile/status (Task 74 Stage B) ────────────────────────
 *
 * POST { action: "activate" | "pause" | "resume" }
 *
 * Owner-only profile state transitions, all re-checked server-side:
 *   activate — draft|paused → active. Requires the eligibility gate (18+),
 *              complete content (languages, intention, timeline) and account
 *              location (state + city, sourced from User).
 *   pause    — active → paused. Hidden from everything but the owner.
 *   resume   — paused → active. The eligibility gate runs again first, so a
 *              member whose DOB changed to an ineligible value cannot resume.
 *
 * "restricted" has NO self-service transition — only admins release it
 * (Stage E). The client can never set an arbitrary status.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["activate", "pause", "resume"]),
});

export async function POST(req: NextRequest) {
  const gate = await requireMatrimonyMember();
  if (!gate.member) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const { action } = parsed.data;

  const profile = await db.matrimonyProfile.findUnique({
    where: { userId: gate.member.id },
    include: matrimonyProfileInclude,
  });
  if (!profile) {
    return NextResponse.json({ error: "Create your profile first." }, { status: 404 });
  }

  if (profile.status === "restricted") {
    return NextResponse.json(
      {
        error: "This profile is restricted. Please contact support for review.",
        code: "PROFILE_RESTRICTED",
      },
      { status: 403 }
    );
  }

  if (action === "activate") {
    if (profile.status !== "draft" && profile.status !== "paused") {
      return NextResponse.json(
        { error: `Cannot activate a ${profile.status} profile.` },
        { status: 409 }
      );
    }
    // Content completeness — required fields only (optional fields stay optional).
    const languages = JSON.parse(profile.languages || "[]");
    const missing: string[] = [];
    if (!Array.isArray(languages) || languages.length === 0) missing.push("languages");
    if (!profile.intention) missing.push("marriage intention");
    if (!profile.timeline) missing.push("timeline");
    if (!gate.member.state || !gate.member.city) missing.push("state and city");
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Complete your profile before activating: missing ${missing.join(", ")}.`,
          code: "PROFILE_INCOMPLETE",
        },
        { status: 400 }
      );
    }

    const updated = await db.matrimonyProfile.update({
      where: { id: profile.id },
      data: { status: "active", activatedAt: profile.activatedAt ?? new Date() },
      include: matrimonyProfileInclude,
    });
    await logMatrimonyAudit({
      actorId: gate.member.id,
      actorRole: "member",
      action: "profile_activated",
      targetUserId: gate.member.id,
      targetType: "matrimony_profile",
      targetId: profile.id,
      outcome: "ok",
    });
    return NextResponse.json({ profile: serializeMatrimonyProfile(updated) });
  }

  if (action === "pause") {
    if (profile.status !== "active") {
      return NextResponse.json(
        { error: "Only an active profile can be paused." },
        { status: 409 }
      );
    }
    const updated = await db.matrimonyProfile.update({
      where: { id: profile.id },
      data: { status: "paused" },
      include: matrimonyProfileInclude,
    });
    await logMatrimonyAudit({
      actorId: gate.member.id,
      actorRole: "member",
      action: "profile_paused",
      targetUserId: gate.member.id,
      targetType: "matrimony_profile",
      targetId: profile.id,
      outcome: "ok",
    });
    return NextResponse.json({ profile: serializeMatrimonyProfile(updated) });
  }

  // resume
  if (profile.status !== "paused") {
    return NextResponse.json(
      { error: "Only a paused profile can be resumed." },
      { status: 409 }
    );
  }
  // The eligibility gate already re-verified age + account status above, so
  // a member whose DOB changed to an ineligible value can never resume.
  const updated = await db.matrimonyProfile.update({
    where: { id: profile.id },
    data: { status: "active" },
    include: matrimonyProfileInclude,
  });
  await logMatrimonyAudit({
    actorId: gate.member.id,
    actorRole: "member",
    action: "profile_resumed",
    targetUserId: gate.member.id,
    targetType: "matrimony_profile",
    targetId: profile.id,
    outcome: "ok",
  });
  return NextResponse.json({ profile: serializeMatrimonyProfile(updated) });
}
