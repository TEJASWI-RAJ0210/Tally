import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Net balance between two users, from the perspective of `userId`.
 * Positive => friendId owes userId. Negative => userId owes friendId.
 */
export async function getBalanceBetween(userId: string, friendId: string): Promise<Decimal> {
  const [owedToUser, owedByUser, paidByUserToFriend, paidByFriendToUser] = await Promise.all([
    prisma.expenseShare.aggregate({
      _sum: { amountOwed: true },
      where: { userId: friendId, expense: { paidById: userId, deletedAt: null } },
    }),
    prisma.expenseShare.aggregate({
      _sum: { amountOwed: true },
      where: { userId: userId, expense: { paidById: friendId, deletedAt: null } },
    }),
    prisma.settlement.aggregate({
      _sum: { amount: true },
      where: { fromUserId: userId, toUserId: friendId },
    }),
    prisma.settlement.aggregate({
      _sum: { amount: true },
      where: { fromUserId: friendId, toUserId: userId },
    }),
  ]);

  const a = owedToUser._sum.amountOwed ?? new Decimal(0);
  const b = owedByUser._sum.amountOwed ?? new Decimal(0);
  const c = paidByUserToFriend._sum.amount ?? new Decimal(0);
  const d = paidByFriendToUser._sum.amount ?? new Decimal(0);

  // A payment increases the payer's net position and decreases the recipient's.
  return a.minus(b).plus(c).minus(d);
}

export async function getAllBalancesForUser(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ userId }, { friendId: userId }] },
  });

  const friendIds = [...new Set(friendships.map((f) => (f.userId === userId ? f.friendId : f.userId)))];

  const balances = await Promise.all(
    friendIds.map(async (friendId) => ({
      friendId,
      balance: await getBalanceBetween(userId, friendId),
    }))
  );

  const totalOwedToYou = balances
    .filter((b) => b.balance.greaterThan(0))
    .reduce((sum, b) => sum.plus(b.balance), new Decimal(0));

  const totalYouOwe = balances
    .filter((b) => b.balance.lessThan(0))
    .reduce((sum, b) => sum.plus(b.balance.abs()), new Decimal(0));

  return { balances, totalOwedToYou, totalYouOwe };
}

export async function getGroupBalances(groupId: string): Promise<Map<string, Decimal>> {
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const net = new Map<string, Decimal>(members.map((m) => [m.userId, new Decimal(0)]));

  const expenses = await prisma.expense.findMany({
    where: { groupId, deletedAt: null },
    include: { shares: true },
  });

  for (const expense of expenses) {
    net.set(expense.paidById, (net.get(expense.paidById) ?? new Decimal(0)).plus(expense.amount));
    for (const share of expense.shares) {
      net.set(share.userId, (net.get(share.userId) ?? new Decimal(0)).minus(share.amountOwed));
    }
  }

  const settlements = await prisma.settlement.findMany({ where: { groupId } });
  for (const s of settlements) {
    net.set(s.fromUserId, (net.get(s.fromUserId) ?? new Decimal(0)).plus(s.amount));
    net.set(s.toUserId, (net.get(s.toUserId) ?? new Decimal(0)).minus(s.amount));
  }

  return net;
}
