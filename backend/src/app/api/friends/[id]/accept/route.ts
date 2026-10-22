import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId(req);
    const friendship = await prisma.friendship.findUnique({ where: { id: params.id } });
    if (!friendship || friendship.friendId !== userId || friendship.status !== "PENDING") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    const accepted = await prisma.friendship.updateMany({
      where: {
        OR: [
          { userId: friendship.userId, friendId: friendship.friendId },
          { userId: friendship.friendId, friendId: friendship.userId },
        ],
      },
      data: { status: "ACCEPTED" },
    });
    return NextResponse.json({ friendship: { ...friendship, status: "ACCEPTED" }, updatedCount: accepted.count });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to accept" }, { status: 500 });
  }
}
