import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const groupId = req.nextUrl.searchParams.get("groupId") ?? undefined;

    const [expenses, settlements] = await Promise.all([
      prisma.expense.findMany({
        where: {
          deletedAt: null,
          ...(groupId ? { groupId } : { OR: [{ paidById: userId }, { shares: { some: { userId } } }] }),
        },
        include: { paidBy: true, shares: true },
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.settlement.findMany({
        where: { ...(groupId ? { groupId } : { OR: [{ fromUserId: userId }, { toUserId: userId }] }) },
        include: { fromUser: true, toUser: true },
        orderBy: { date: "desc" },
        take: 50,
      }),
    ]);

    const feed = [
      ...expenses.map((e) => ({ type: "expense" as const, date: e.date, data: e })),
      ...settlements.map((s) => ({ type: "settlement" as const, date: s.date, data: s })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return NextResponse.json({ feed });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
