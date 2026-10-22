import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * POST /api/contact
 * Public — accepts contact form submissions and stores them as ContactMessage records.
 * Admin can view them in the admin panel (future task).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields: name, email, subject, message" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    await db.contactMessage.create({
      data: {
        name: String(name).slice(0, 200),
        email: String(email).slice(0, 200),
        phone: phone ? String(phone).slice(0, 20) : null,
        subject: String(subject).slice(0, 200),
        message: String(message).slice(0, 5000),
      },
    });

    return NextResponse.json({ success: true, message: "Your message has been received." });
  } catch (error: any) {
    console.error("[api/contact] Error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
