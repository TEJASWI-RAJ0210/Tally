import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const groupId = req.nextUrl.searchParams.get("groupId") ?? undefined;
    // Settled records still power balance calculations, so only hide them from
    // the activity feed after 20 days instead of deleting them from storage.
    const settledCutoff = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

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
        where: {
          ...(groupId ? { groupId } : { OR: [{ fromUserId: userId }, { toUserId: userId }] }),
          AND: [{
            OR: [
              { status: { not: "CONFIRMED" } },
              { status: "CONFIRMED", resolvedAt: { gte: settledCutoff } },
              // Older confirmed records may not have a resolvedAt timestamp.
              { status: "CONFIRMED", resolvedAt: null, date: { gte: settledCutoff } },
            ],
          }],
        },
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
