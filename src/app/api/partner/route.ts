import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * POST /api/partner
 * Public — accepts partnership inquiry submissions and stores them as PartnerInquiry records.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, organization, email, phone, website, partnershipType, message } = body;

    if (!name || !email || !partnershipType || !message) {
      return NextResponse.json({ error: "Missing required fields: name, email, partnershipType, message" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const validTypes = ["Church", "Ministry", "Christian Business", "Event Partner", "Content Partner", "Sponsor", "Technology Partner", "Other"];
    if (!validTypes.includes(partnershipType)) {
      return NextResponse.json({ error: "Invalid partnership type" }, { status: 400 });
    }

    await db.partnerInquiry.create({
      data: {
        name: String(name).slice(0, 200),
        organization: organization ? String(organization).slice(0, 200) : null,
        email: String(email).slice(0, 200),
        phone: phone ? String(phone).slice(0, 20) : null,
        website: website ? String(website).slice(0, 500) : null,
        partnershipType,
        message: String(message).slice(0, 5000),
      },
    });

    return NextResponse.json({ success: true, message: "Your partnership inquiry has been received." });
  } catch (error: any) {
    console.error("[api/partner] Error:", error);
    return NextResponse.json({ error: "Failed to submit inquiry" }, { status: 500 });
  }
}
