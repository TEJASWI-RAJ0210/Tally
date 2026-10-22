import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const q = req.nextUrl.searchParams.get("u")?.toLowerCase().trim();
    if (!q) return NextResponse.json({ users: [] });

    const users = await prisma.user.findMany({
      where: { username: { contains: q, mode: "insensitive" }, id: { not: userId } },
      select: { id: true, name: true, username: true, avatarUrl: true },
      take: 10,
    });
    return NextResponse.json({ users });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
