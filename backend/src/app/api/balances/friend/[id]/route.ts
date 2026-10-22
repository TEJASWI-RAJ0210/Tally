import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";
import { getBalanceBetween } from "@/lib/balances";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId(req);
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId, friendId: params.id },
          { userId: params.id, friendId: userId },
        ],
      },
    });
    if (!friendship) return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    const balance = await getBalanceBetween(userId, params.id);
    return NextResponse.json({ friendId: params.id, balance: balance.toFixed(2) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load balance" }, { status: 500 });
  }
}
