import { prisma } from "./prisma";
import { Prisma, PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type BalanceDb = PrismaClient | Prisma.TransactionClient;

/**
 * Net balance between two users, from the perspective of `userId`.
 * Positive => friendId owes userId. Negative => userId owes friendId.
 */
export async function getBalanceBetween(userId: string, friendId: string, db: BalanceDb = prisma): Promise<Decimal> {
  const [owedToUser, owedByUser, paidByUserToFriend, paidByFriendToUser] = await Promise.all([
    db.expenseShare.aggregate({
      _sum: { amountOwed: true },
      where: { userId: friendId, expense: { paidById: userId, groupId: null, deletedAt: null } },
    }),
    db.expenseShare.aggregate({
      _sum: { amountOwed: true },
      where: { userId: userId, expense: { paidById: friendId, groupId: null, deletedAt: null } },
    }),
    db.settlement.aggregate({
      _sum: { amount: true },
      where: { fromUserId: userId, toUserId: friendId, groupId: null, status: "CONFIRMED" },
    }),
    db.settlement.aggregate({
      _sum: { amount: true },
      where: { fromUserId: friendId, toUserId: userId, groupId: null, status: "CONFIRMED" },
    }),
  ]);

  const a = owedToUser._sum.amountOwed ?? new Decimal(0);
  const b = owedByUser._sum.amountOwed ?? new Decimal(0);
  const c = paidByUserToFriend._sum.amount ?? new Decimal(0);
  const d = paidByFriendToUser._sum.amount ?? new Decimal(0);

  // A payment increases the payer's net position and decreases the recipient's.
  return a.minus(b).plus(c).minus(d);
}

/** Calculate every personal friend balance with one grouped database query. */
export async function getBalancesForFriends(userId: string, friendIds: string[]) {
  const uniqueFriendIds = [...new Set(friendIds.filter((id) => id !== userId))];
  if (uniqueFriendIds.length === 0) return new Map<string, Decimal>();

  const rows = await prisma.$queryRaw<Array<{ friendId: string; balance: Decimal }>>(Prisma.sql`
    SELECT ledger."friendId", SUM(ledger.amount)::numeric AS balance
    FROM (
      SELECT share."userId" AS "friendId", share."amountOwed" AS amount
      FROM "ExpenseShare" share
      JOIN "Expense" expense ON expense.id = share."expenseId"
      WHERE expense."paidById" = ${userId}
        AND expense."groupId" IS NULL
        AND expense."deletedAt" IS NULL
        AND share."userId" IN (${Prisma.join(uniqueFriendIds)})

      UNION ALL

      SELECT expense."paidById" AS "friendId", -share."amountOwed" AS amount
      FROM "ExpenseShare" share
      JOIN "Expense" expense ON expense.id = share."expenseId"
      WHERE share."userId" = ${userId}
        AND expense."groupId" IS NULL
        AND expense."deletedAt" IS NULL
        AND expense."paidById" IN (${Prisma.join(uniqueFriendIds)})

      UNION ALL

      SELECT settlement."toUserId" AS "friendId", settlement.amount
      FROM "Settlement" settlement
      WHERE settlement."fromUserId" = ${userId}
        AND settlement."groupId" IS NULL
        AND settlement.status = 'CONFIRMED'
        AND settlement."toUserId" IN (${Prisma.join(uniqueFriendIds)})

      UNION ALL

      SELECT settlement."fromUserId" AS "friendId", -settlement.amount AS amount
      FROM "Settlement" settlement
      WHERE settlement."toUserId" = ${userId}
        AND settlement."groupId" IS NULL
        AND settlement.status = 'CONFIRMED'
        AND settlement."fromUserId" IN (${Prisma.join(uniqueFriendIds)})
    ) ledger
    GROUP BY ledger."friendId"
  `);

  const balances = new Map(uniqueFriendIds.map((friendId) => [friendId, new Decimal(0)]));
  for (const row of rows) balances.set(row.friendId, new Decimal(row.balance));
  return balances;
}

export async function getAllBalancesForUser(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ userId }, { friendId: userId }] },
  });

  const friendIds = [...new Set(friendships.map((f) => (f.userId === userId ? f.friendId : f.userId)))];

  const balanceByFriend = await getBalancesForFriends(userId, friendIds);
  const balances = friendIds.map((friendId) => ({ friendId, balance: balanceByFriend.get(friendId) ?? new Decimal(0) }));

  const totalOwedToYou = balances
    .filter((b) => b.balance.greaterThan(0))
    .reduce((sum, b) => sum.plus(b.balance), new Decimal(0));

  const totalYouOwe = balances
    .filter((b) => b.balance.lessThan(0))
    .reduce((sum, b) => sum.plus(b.balance.abs()), new Decimal(0));

  return { balances, totalOwedToYou, totalYouOwe };
}

/** Group balances remain separate from personal friend-to-friend balances. */
export async function getAllGroupBalancesForUser(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { group: { select: { id: true, name: true } } },
  });

  const groupIds = memberships.map(({ group }) => group.id);
  if (groupIds.length === 0) return [];

  const rows = await prisma.$queryRaw<Array<{ groupId: string; balance: Decimal }>>(Prisma.sql`
    SELECT ledger."groupId", SUM(ledger.amount)::numeric AS balance
    FROM (
      SELECT expense."groupId", expense.amount
      FROM "Expense" expense
      WHERE expense."paidById" = ${userId}
        AND expense."deletedAt" IS NULL
        AND expense."groupId" IN (${Prisma.join(groupIds)})

      UNION ALL

      SELECT expense."groupId", -share."amountOwed" AS amount
      FROM "ExpenseShare" share
      JOIN "Expense" expense ON expense.id = share."expenseId"
      WHERE share."userId" = ${userId}
        AND expense."deletedAt" IS NULL
        AND expense."groupId" IN (${Prisma.join(groupIds)})

      UNION ALL

      SELECT settlement."groupId", settlement.amount
      FROM "Settlement" settlement
      WHERE settlement."fromUserId" = ${userId}
        AND settlement.status = 'CONFIRMED'
        AND settlement."groupId" IN (${Prisma.join(groupIds)})

      UNION ALL

      SELECT settlement."groupId", -settlement.amount AS amount
      FROM "Settlement" settlement
      WHERE settlement."toUserId" = ${userId}
        AND settlement.status = 'CONFIRMED'
        AND settlement."groupId" IN (${Prisma.join(groupIds)})
    ) ledger
    GROUP BY ledger."groupId"
  `);
  const balanceByGroup = new Map(rows.map((row) => [row.groupId, new Decimal(row.balance)]));

  return memberships.map(({ group }) => ({
    group,
    balance: balanceByGroup.get(group.id) ?? new Decimal(0),
  }));
}

export async function getGroupBalances(groupId: string, db: BalanceDb = prisma): Promise<Map<string, Decimal>> {
  const [members, rows] = await Promise.all([
    db.groupMember.findMany({ where: { groupId }, select: { userId: true } }),
    db.$queryRaw<Array<{ userId: string; balance: Decimal }>>(Prisma.sql`
      SELECT ledger."userId", SUM(ledger.amount)::numeric AS balance
      FROM (
        SELECT expense."paidById" AS "userId", expense.amount
        FROM "Expense" expense
        WHERE expense."groupId" = ${groupId} AND expense."deletedAt" IS NULL

        UNION ALL

        SELECT share."userId", -share."amountOwed" AS amount
        FROM "ExpenseShare" share
        JOIN "Expense" expense ON expense.id = share."expenseId"
        WHERE expense."groupId" = ${groupId} AND expense."deletedAt" IS NULL

        UNION ALL

        SELECT settlement."fromUserId" AS "userId", settlement.amount
        FROM "Settlement" settlement
        WHERE settlement."groupId" = ${groupId} AND settlement.status = 'CONFIRMED'

        UNION ALL

        SELECT settlement."toUserId" AS "userId", -settlement.amount AS amount
        FROM "Settlement" settlement
        WHERE settlement."groupId" = ${groupId} AND settlement.status = 'CONFIRMED'
      ) ledger
      GROUP BY ledger."userId"
    `),
  ]);
  const net = new Map<string, Decimal>(members.map(({ userId }) => [userId, new Decimal(0)]));
  for (const row of rows) net.set(row.userId, new Decimal(row.balance));

  return net;
}
