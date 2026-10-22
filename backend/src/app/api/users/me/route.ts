import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { passwordHash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
}

const patchSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i).optional(),
  name: z.string().min(1).max(60).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const data = patchSchema.parse(await req.json());

    if (data.username) {
      const existing = await prisma.user.findUnique({ where: { username: data.username.toLowerCase() } });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
      data.username = data.username.toLowerCase();
    }

    const user = await prisma.user.update({ where: { id: userId }, data });
    const { passwordHash, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
