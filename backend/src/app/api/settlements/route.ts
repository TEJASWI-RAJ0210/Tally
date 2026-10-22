import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";
import { getBalanceBetween, getGroupBalances } from "@/lib/balances";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const statusParam = req.nextUrl.searchParams.get("status");
    const status = statusParam ? z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).safeParse(statusParam) : null;
    if (status && !status.success) return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
    if (status?.success && status.data !== "PENDING") return NextResponse.json({ error: "Only pending payment requests are available" }, { status: 400 });
    if (!status) return NextResponse.json({ error: "Payment request status is required" }, { status: 400 });
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 30);
    const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 20;

    const settlements = await prisma.settlement.findMany({
      where: {
        status: "PENDING",
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        fromUser: { select: { id: true, name: true, username: true } },
        toUser: { select: { id: true, name: true, username: true } },
      },
    });

    return NextResponse.json({ settlements });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    console.error("Loading settlements failed", e);
    return NextResponse.json({ error: "Failed to load settlements" }, { status: 500 });
  }
}

const bodySchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.number().positive().refine((value) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, "Use no more than two decimal places"),
  groupId: z.string().uuid().optional(),
  note: z.string().trim().max(240).optional(),
}).refine((data) => data.fromUserId !== data.toUserId, { message: "A payment needs two different people" });

export async function POST(req: NextRequest) {
  let idempotencyKey: string | undefined;
  let parsedData: z.infer<typeof bodySchema> | undefined;
  let actorId: string | undefined;
  try {
    const userId = requireUserId(req);
    actorId = userId;
    const data = bodySchema.parse(await req.json());
    parsedData = data;
    idempotencyKey = data.idempotencyKey;
    if (userId !== data.fromUserId && userId !== data.toUserId) {
      return NextResponse.json({ error: "You must be part of this payment" }, { status: 403 });
    }

    if (data.idempotencyKey) {
      const existing = await prisma.settlement.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) {
        if (existing.initiatedById !== userId || existing.fromUserId !== data.fromUserId || existing.toUserId !== data.toUserId || existing.groupId !== (data.groupId ?? null) || existing.amount.toNumber() !== data.amount) {
          return NextResponse.json({ error: "Payment key was already used for a different record" }, { status: 409 });
        }
        return NextResponse.json({ settlement: existing, duplicate: true }, { status: 200 });
      }
    }

    if (data.groupId) {
      const participantIds = [...new Set([userId, data.fromUserId, data.toUserId])];
      const memberships = await prisma.groupMember.findMany({
        where: { groupId: data.groupId, userId: { in: participantIds } },
        select: { userId: true },
      });
      if (new Set(memberships.map((member) => member.userId)).size !== participantIds.length) {
        return NextResponse.json({ error: "All payment participants must belong to the group" }, { status: 403 });
      }
      const groupBalances = await getGroupBalances(data.groupId);
      const fromBalance = groupBalances.get(data.fromUserId)?.toNumber() ?? 0;
      const toBalance = groupBalances.get(data.toUserId)?.toNumber() ?? 0;
      const maxPayment = Math.min(Math.abs(fromBalance), toBalance);
      if (fromBalance >= 0 || toBalance <= 0 || data.amount > maxPayment + 0.001) {
        return NextResponse.json({ error: "Payment amount is higher than the outstanding group balance" }, { status: 400 });
      }
    } else {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { userId: data.fromUserId, friendId: data.toUserId },
            { userId: data.toUserId, friendId: data.fromUserId },
          ],
        },
      });
      if (!friendship) return NextResponse.json({ error: "Payment must be between accepted friends" }, { status: 403 });
      const balance = await getBalanceBetween(data.fromUserId, data.toUserId);
      if (!balance.lessThan(0) || balance.abs().lessThan(data.amount)) {
        return NextResponse.json({ error: "Payment amount is higher than the outstanding balance" }, { status: 400 });
      }
    }

    const settlement = await prisma.$transaction(async (tx) => {
      return tx.settlement.create({
        data: {
          idempotencyKey: data.idempotencyKey,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          initiatedById: userId,
          amount: data.amount,
          groupId: data.groupId,
          note: data.note,
        },
      });
    });
    return NextResponse.json({ settlement }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid payment amount and participants" }, { status: 400 });
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      if (idempotencyKey) {
        const existing = await prisma.settlement.findUnique({ where: { idempotencyKey } });
        if (existing && parsedData && existing.initiatedById === actorId && existing.fromUserId === parsedData.fromUserId && existing.toUserId === parsedData.toUserId && existing.groupId === (parsedData.groupId ?? null) && existing.amount.toNumber() === parsedData.amount) {
          return NextResponse.json({ settlement: existing, duplicate: true }, { status: 200 });
        }
        if (existing) return NextResponse.json({ error: "Payment key was already used for a different record" }, { status: 409 });
      }
    }
    console.error("Recording settlement failed", e);
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
  }
}
