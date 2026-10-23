#!/usr/bin/env python3
"""Replace next-auth imports and getServerSession calls with Supabase
getAuthUser across the 5 API routes that still use them."""
import re
from pathlib import Path

FILES = [
    "src/app/api/gamification/badges/route.ts",
    "src/app/api/gamification/daily-challenge/route.ts",
    "src/app/api/gamification/daily-spin/route.ts",
    "src/app/api/admin/gifts/route.ts",
    "src/app/api/admin/redemptions/route.ts",
]

ROOT = Path("/home/z/my-project")

for rel in FILES:
    f = ROOT / rel
    content = f.read_text()
    original = content

    # 1. Replace imports: remove next-auth + authOptions, add getAuthUser
    content = re.sub(
        r'import \{ getServerSession \} from "next-auth";\nimport \{ authOptions \} from "@/lib/auth";\n',
        'import { getAuthUser } from "@/lib/auth-server";\n',
        content,
    )

    # 2. Replace session checks of the form:
    #    const session = await getServerSession(authOptions);
    #    if (!session?.user?.id) { return NextResponse.json({ error: "..." }, { status: 401 }); }
    #    const userId = session.user.id;
    #
    #    With:
    #    const authUser = await getAuthUser();
    #    if (!authUser) { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); }
    #    const userId = authUser.id;
    content = re.sub(
        r'const session = await getServerSession\(authOptions\);\n\s*if \(!session\?\.user\?\.id\) \{\n\s*return NextResponse\.json\(\{ error: "[^"]*" \}, \{ status: 401 \}\);\n\s*\}\n\s*const userId = session\.user\.id;',
        'const authUser = await getAuthUser();\n    if (!authUser) {\n      return NextResponse.json({ error: "Authentication required" }, { status: 401 });\n    }\n    const userId = authUser.id;',
        content,
    )

    # 3. Replace requireAdmin pattern (in admin/gifts & admin/redemptions):
    #    const session = await getServerSession(authOptions);
    #    if (!session?.user?.id) return null;
    #    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    #    if (user?.role !== "admin") return null;
    #    return session.user.id;
    content = re.sub(
        r'const session = await getServerSession\(authOptions\);\n\s*if \(!session\?\.user\?\.id\) return null;\n\s*const user = await db\.user\.findUnique\(\{[^}]*\}\);\n\s*if \(user\?\.role !== "admin"\) return null;\n\s*return session\.user\.id;',
        'const authUser = await getAuthUser();\n  if (!authUser) return null;\n  if (authUser.role !== "admin") return null;\n  return authUser.id;',
        content,
    )

    # 4. The "second" version of requireAdmin in admin/redemptions (multi-line where):
    content = re.sub(
        r'const session = await getServerSession\(authOptions\);\n\s*if \(!session\?\.user\?\.id\) return null;\n\s*const user = await db\.user\.findUnique\(\{\n\s*where: \{ id: session\.user\.id \},\n\s*select: \{ role: true \},\n\s*\}\);\n\s*if \(user\?\.role !== "admin"\) return null;\n\s*return session\.user\.id;',
        'const authUser = await getAuthUser();\n  if (!authUser) return null;\n  if (authUser.role !== "admin") return null;\n  return authUser.id;',
        content,
    )

    # 5. daily-challenge has a GET that just reads session without auth check:
    #    const session = await getServerSession(authOptions);
    #    const userId = session?.user?.id;
    content = re.sub(
        r'const session = await getServerSession\(authOptions\);\n\s*const userId = session\?\.user\?\.id;',
        'const authUser = await getAuthUser();\n    const userId = authUser?.id;',
        content,
    )

    if content != original:
        f.write_text(content)
        # Count replacements made
        old_count = original.count("getServerSession")
        new_count = content.count("getServerSession")
        print(f"  {rel}: {old_count} -> {new_count} getServerSession calls")
    else:
        print(f"  {rel}: NO CHANGES (patterns didn't match)")

print("\nDone")
