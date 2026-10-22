import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const groupId = req.nextUrl.searchParams.get("groupId") ?? undefined;
    const friendId = req.nextUrl.searchParams.get("friendId") ?? undefined;
    if (groupId && friendId) {
      return NextResponse.json({ error: "Choose a group or a friend" }, { status: 400 });
    }

    if (groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (!membership) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (friendId) {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { userId, friendId },
            { userId: friendId, friendId: userId },
          ],
        },
      });
      if (!friendship) return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    }

    const expenses = await prisma.expense.findMany({
      where: {
        deletedAt: null,
        ...(groupId ? { groupId } : {}),
        ...(!groupId && !friendId ? { OR: [{ paidById: userId }, { shares: { some: { userId } } }] } : {}),
        ...(friendId
          ? {
              groupId: null,
              OR: [
                { paidById: userId, shares: { some: { userId: friendId } } },
                { paidById: friendId, shares: { some: { userId } } },
              ],
            }
          : {}),
      },
      include: {
        shares: { include: { user: { select: { id: true, name: true, username: true } } } },
        paidBy: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load expenses" }, { status: 500 });
  }
}

const shareSchema = z.object({ userId: z.string().uuid(), amountOwed: z.number().nonnegative() });

const isCentAmount = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;

const createSchema = z.object({
  description: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(9999999999.99).refine(isCentAmount),
  category: z.string().optional(),
  date: z.string().datetime().optional(),
  groupId: z.string().uuid().optional(),
  paidById: z.string().uuid(),
  splitType: z.enum(["EQUAL", "EXACT"]),
  shares: z.array(shareSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const data = createSchema.parse(await req.json());
    if (data.paidById !== userId) {
      return NextResponse.json({ error: "You can only record expenses that you paid" }, { status: 403 });
    }
    const participantIds = data.shares.map((share) => share.userId);
    if (new Set(participantIds).size !== participantIds.length) {
      return NextResponse.json({ error: "Each participant can only appear once" }, { status: 400 });
    }
    if (data.shares.some((share) => !isCentAmount(share.amountOwed))) {
      return NextResponse.json({ error: "Each split amount must use cents (up to 2 decimal places)" }, { status: 400 });
    }

    if (data.groupId) {
      const memberships = await prisma.groupMember.findMany({
        where: { groupId: data.groupId, userId: { in: [...new Set([userId, ...participantIds])] } },
        select: { userId: true },
      });
      const memberIds = new Set(memberships.map((member) => member.userId));
      if (!memberIds.has(userId) || participantIds.some((id) => !memberIds.has(id))) {
        return NextResponse.json({ error: "All expense participants must belong to the group" }, { status: 403 });
      }
    } else {
      const friendIds = participantIds.filter((id) => id !== userId);
      if (friendIds.length) {
        const friendships = await prisma.friendship.findMany({
          where: {
            status: "ACCEPTED",
            OR: [
              { userId, friendId: { in: friendIds } },
              { friendId: userId, userId: { in: friendIds } },
            ],
          },
        });
        const acceptedIds = new Set(friendships.map((friendship) =>
          friendship.userId === userId ? friendship.friendId : friendship.userId
        ));
        if (friendIds.some((id) => !acceptedIds.has(id))) {
          return NextResponse.json({ error: "Expense participants must be accepted friends" }, { status: 403 });
        }
      }
    }

    const amountCents = Math.round(data.amount * 100);
    const sharesCents = data.shares.map((share) => Math.round(share.amountOwed * 100));
    if (amountCents < sharesCents.length || sharesCents.some((cents) => cents <= 0)) {
      return NextResponse.json({ error: "Each selected participant must have a share of at least one cent" }, { status: 400 });
    }
    const totalShareCents = sharesCents.reduce((sum, cents) => sum + cents, 0);
    if (totalShareCents !== amountCents) {
      return NextResponse.json(
        { error: "Split amounts must add up to the expense total exactly" },
        { status: 400 }
      );
    }

    if (data.splitType === "EQUAL") {
      const baseCents = Math.floor(amountCents / sharesCents.length);
      const remainderCents = amountCents - baseCents * sharesCents.length;
      const equalShares = sharesCents.every((cents, index) => cents === baseCents + (index === 0 ? remainderCents : 0));
      if (!equalShares) {
        return NextResponse.json({ error: "Equal splits must divide the total evenly across selected people" }, { status: 400 });
      }
    }

    const expense = await prisma.expense.create({
      data: {
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: data.date ? new Date(data.date) : undefined,
        groupId: data.groupId,
        paidById: data.paidById,
        splitType: data.splitType,
        shares: { create: data.shares.map((s) => ({ userId: s.userId, amountOwed: s.amountOwed })) },
      },
      include: { shares: true },
    });

    // TODO: push notification to all participants except the creator

    return NextResponse.json({ expense }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter valid expense details" }, { status: 400 });
    console.error("Expense creation failed", e);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
