import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUserId } from "@/lib/authMiddleware";
import { getBalanceBetween, getGroupBalances } from "@/lib/balances";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId(req);
    const body = await req.json();
    if (body?.action !== "confirm") return NextResponse.json({ error: "Only payment confirmation is supported" }, { status: 400 });

    const settlement = await prisma.settlement.findUnique({ where: { id: params.id } });
    if (!settlement) return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
    if (userId !== settlement.fromUserId && userId !== settlement.toUserId) {
      return NextResponse.json({ error: "You are not part of this payment" }, { status: 403 });
    }
    if (userId === settlement.initiatedById) {
      return NextResponse.json({ error: "The other person must confirm this payment" }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.settlement.findUnique({ where: { id: settlement.id } });
      if (!current || current.status !== "PENDING") return { count: 0, error: "This payment has already been resolved" };
      if (current.groupId) {
        const balances = await getGroupBalances(current.groupId, tx);
        const fromBalance = balances.get(current.fromUserId)?.toNumber() ?? 0;
        const toBalance = balances.get(current.toUserId)?.toNumber() ?? 0;
        const available = Math.min(Math.abs(fromBalance), toBalance);
        if (fromBalance >= 0 || toBalance <= 0 || current.amount.toNumber() > available + 0.001) {
          return { count: 0, error: "The group balance changed. Ask the payer to record a new payment request." };
        }
      } else {
        const balance = await getBalanceBetween(current.fromUserId, current.toUserId, tx);
        if (!balance.lessThan(0) || balance.abs().lessThan(current.amount)) {
          return { count: 0, error: "The balance changed. Ask the payer to record a new payment request." };
        }
      }
      const changed = await tx.settlement.updateMany({
        where: { id: settlement.id, status: "PENDING" },
        data: { status: "CONFIRMED", resolvedAt: new Date(), resolvedById: userId },
      });
      return { count: changed.count, error: changed.count ? null : "This payment was updated elsewhere" };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!result.count) return NextResponse.json({ error: result.error }, { status: 409 });
    const updated = await prisma.settlement.findUnique({ where: { id: settlement.id } });
    return NextResponse.json({ settlement: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    console.error("Confirming payment failed", e);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
