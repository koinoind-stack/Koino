
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function present(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}

export function GET() {
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    serverEnv: {
      NEXT_PUBLIC_SUPABASE_URL: present(
        process.env.NEXT_PUBLIC_SUPABASE_URL
      ),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
      NEXT_PUBLIC_SITE_URL: present(process.env.NEXT_PUBLIC_SITE_URL),
    },
    note: "Booleans only - no variable values are exposed.",
  });
}
