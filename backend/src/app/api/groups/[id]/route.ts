import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId(req);
    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        },
        expenses: {
          where: { deletedAt: null },
          orderBy: { date: "desc" },
          include: {
            paidBy: { select: { id: true, name: true, username: true } },
            shares: { include: { user: { select: { id: true, name: true, username: true } } } },
          },
        },
      },
    });
    if (!group || !group.members.some((member) => member.userId === userId)) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    return NextResponse.json({ group });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load group" }, { status: 500 });
  }
}
