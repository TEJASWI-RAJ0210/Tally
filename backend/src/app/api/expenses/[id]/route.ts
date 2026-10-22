import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, AuthError } from "@/lib/authMiddleware";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId(req);
    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        shares: { include: { user: { select: { id: true, name: true, username: true } } } },
        paidBy: { select: { id: true, name: true, username: true } },
      },
    });
    if (!expense || expense.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (expense.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: expense.groupId, userId } },
      });
      if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    } else if (expense.paidById !== userId && !expense.shares.some((share) => share.userId === userId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ expense });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Failed to load expense" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId(req);
    const result = await prisma.expense.updateMany({
      where: { id: params.id, paidById: userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) return NextResponse.json({ error: "Expense not found or you cannot delete it" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    console.error("Deleting expense failed", e);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
