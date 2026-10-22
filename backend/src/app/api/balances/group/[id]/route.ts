import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";
import { getGroupBalances } from "@/lib/balances";
import { simplifyDebts } from "@/lib/simplifyDebts";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId(req);
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: params.id, userId } },
    });
    if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    const net = await getGroupBalances(params.id);
    const users = await prisma.user.findMany({
      where: { id: { in: [...net.keys()] } },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      balances: [...net.entries()].map(([userId, amount]) => ({
        user: userMap.get(userId),
        netBalance: amount.toFixed(2),
      })),
      simplifiedSettlementPlan: simplifyDebts(net).map((item) => ({
        from: userMap.get(item.fromUserId),
        to: userMap.get(item.toUserId),
        amount: item.amount,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load group balances" }, { status: 500 });
  }
}
