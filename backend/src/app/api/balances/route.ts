import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";
import { getAllBalancesForUser, getAllGroupBalancesForUser } from "@/lib/balances";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const [{ balances, totalOwedToYou, totalYouOwe }, groupBalances] = await Promise.all([
      getAllBalancesForUser(userId),
      getAllGroupBalancesForUser(userId),
    ]);

    const friends = await prisma.user.findMany({
      where: { id: { in: balances.map((b) => b.friendId) } },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });
    const friendMap = new Map(friends.map((f) => [f.id, f]));

    return NextResponse.json({
      totalOwedToYou: totalOwedToYou.toFixed(2),
      totalYouOwe: totalYouOwe.toFixed(2),
      balances: balances.map((b) => ({
        friend: friendMap.get(b.friendId),
        balance: b.balance.toFixed(2),
      })),
      groupBalances: groupBalances.map(({ group, balance }) => ({
        group,
        balance: balance.toFixed(2),
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load balances" }, { status: 500 });
  }
}
