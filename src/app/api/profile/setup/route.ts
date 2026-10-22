import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * POST /api/profile/setup
 *
 * Saves the user's onboarding profile (step 1 + step 2 + step 3).
 * Server-authoritative — the userId is read from the auth session, NOT
 * from the request body. All fields are validated server-side.
 *
 * Body (all fields optional except where marked):
 *   step: "profile" | "faith" | "whatsapp" | "complete"
 *   username: string (required for step="profile")
 *   dateOfBirth: string (ISO date, required for step="profile")
 *   gender: "male" | "female" | "prefer_not_to_say" (optional)
 *   state: string (required for step="profile")
 *   city: string (required for step="profile")
 *   mobileNumber: string (optional)
 *   faithStatus: "follows_jesus" | "exploring" | "new_to_christianity" | "prefer_not_to_say"
 *   faithJourney: "growing" | "new_to_jesus" | "exploring_christianity" | "looking_for_church" | "learn_and_connect"
 *   whatsappChannelClicked: boolean (optional — true when user taps the WhatsApp link)
 *
 * Returns: { success: true, profileCompleted: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const step = body.step as "profile" | "faith" | "whatsapp" | "complete";

    // Build update data based on which step is being saved.
    // This allows partial saves (e.g. user completes step 1 then exits —
    // their data is preserved, and they resume from step 2 on next login).
    const data: any = {};

    if (step === "profile") {
      // Validate required fields
      const username = (body.username || "").trim();
      const dateOfBirth = body.dateOfBirth;
      const state = (body.state || "").trim();
      const city = (body.city || "").trim();

      if (!username || username.length < 3) {
        return NextResponse.json(
          { field: "username", error: "Username must be at least 3 characters" },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
        return NextResponse.json(
          { field: "username", error: "Username can only contain letters, numbers, underscores, and periods" },
          { status: 400 }
        );
      }
      // Date of birth is now optional (not required per updated spec)
      // Mobile number is required
      if (!body.mobileNumber || !String(body.mobileNumber).trim()) {
        return NextResponse.json(
          { field: "mobileNumber", error: "Mobile number is required" },
          { status: 400 }
        );
      }
      // Date of birth is optional — do not require it
      if (dateOfBirth) {
        data.dateOfBirth = new Date(dateOfBirth);
      }
      if (!state) {
        return NextResponse.json(
          { field: "state", error: "State is required" },
          { status: 400 }
        );
      }
      if (!city) {
        return NextResponse.json(
          { field: "city", error: "City is required" },
          { status: 400 }
        );
      }

      // Check username uniqueness (server-side + DB-level)
      const existing = await db.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" }, NOT: { id: user.id } },
      });
      if (existing) {
        return NextResponse.json(
          { field: "username", error: "That username is already taken." },
          { status: 409 }
        );
      }

      data.username = username;
      data.dateOfBirth = new Date(dateOfBirth);
      data.state = state;
      data.city = city;

      // Optional fields
      if (body.image !== undefined) {
        data.image = body.image || null;
      }
      if (body.gender) {
        const validGenders = ["male", "female", "prefer_not_to_say"];
        if (!validGenders.includes(body.gender)) {
          return NextResponse.json({ error: "Invalid gender value" }, { status: 400 });
        }
        data.gender = body.gender;
      }
      if (body.mobileNumber) {
        // Strip non-numeric chars, store digits only
        data.mobileNumber = String(body.mobileNumber).replace(/[^0-9+]/g, "");
      }
    }

    if (step === "complete") {
      // When completing onboarding, DON'T re-validate profile fields from the
      // request body (they were already validated + saved in the "profile" step).
      // Instead, READ the existing user record from the DB and verify all
      // required fields are present. If any are missing, return a clear error
      // telling the client which step to go back to.
      const existingUser = await db.user.findUnique({ where: { id: user.id } });
      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Verify required profile fields exist in the DB
      // Required: username, mobileNumber, state, city (NOT dateOfBirth)
      if (!existingUser.username || existingUser.username.trim().length < 3) {
        return NextResponse.json(
          { field: "username", error: "Username is missing or invalid. Please complete your profile.", step: "profile" },
          { status: 400 }
        );
      }
      if (!existingUser.mobileNumber) {
        return NextResponse.json(
          { field: "mobileNumber", error: "Mobile number is missing. Please complete your profile.", step: "profile" },
          { status: 400 }
        );
      }
      if (!existingUser.state) {
        return NextResponse.json(
          { field: "state", error: "State is missing. Please complete your profile.", step: "profile" },
          { status: 400 }
        );
      }
      if (!existingUser.city) {
        return NextResponse.json(
          { field: "city", error: "City is missing. Please complete your profile.", step: "profile" },
          { status: 400 }
        );
      }

      // Verify faith questions are answered
      if (!existingUser.faithStatus) {
        return NextResponse.json(
          { field: "faithStatus", error: "Please answer the faith questions.", step: "faith" },
          { status: 400 }
        );
      }
      if (!existingUser.faithJourney) {
        return NextResponse.json(
          { field: "faithJourney", error: "Please answer the faith questions.", step: "faith" },
          { status: 400 }
        );
      }

      // Track WhatsApp channel interaction
      data.whatsappChannelPromptShown = true;
      if (body.whatsappChannelClicked === true) {
        data.whatsappChannelClicked = true;
      }

      // Mark profile as complete — all required fields verified
      data.profileCompleted = true;
    }

    // Handle faith step (standalone save)
    if (step === "faith") {
      if (body.faithStatus) {
        const validStatuses = ["follows_jesus", "exploring", "new_to_christianity", "prefer_not_to_say"];
        if (!validStatuses.includes(body.faithStatus)) {
          return NextResponse.json({ error: "Invalid faith status" }, { status: 400 });
        }
        data.faithStatus = body.faithStatus;
      }
      if (body.faithJourney) {
        const validJourneys = ["growing", "new_to_jesus", "exploring_christianity", "looking_for_church", "learn_and_connect"];
        if (!validJourneys.includes(body.faithJourney)) {
          return NextResponse.json({ error: "Invalid faith journey" }, { status: 400 });
        }
        data.faithJourney = body.faithJourney;
      }
    }

    // Always update name if provided (from Google display name suggestion)
    if (body.name) {
      data.name = String(body.name).trim().slice(0, 100);
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        username: true,
        profileCompleted: true,
      },
    });

    return NextResponse.json({
      success: true,
      profileCompleted: updated.profileCompleted,
    });
  } catch (error: any) {
    console.error("[profile/setup] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save profile" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile/setup
 *
 * Returns the current user's profile completion status + any partially-saved
 * onboarding data (so the user can resume from where they left off).
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const full = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        username: true,
        dateOfBirth: true,
        gender: true,
        state: true,
        city: true,
        mobileNumber: true,
        mobileVerified: true,
        faithStatus: true,
        faithJourney: true,
        profileCompleted: true,
        whatsappChannelPromptShown: true,
        whatsappChannelClicked: true,
        signupMethod: true,
      },
    });

    if (!full) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ profile: full });
  } catch (error: any) {
    console.error("[profile/setup] GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load profile" },
      { status: 500 }
    );
  }
}
