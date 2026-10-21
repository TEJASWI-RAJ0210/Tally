import { Decimal } from "@prisma/client/runtime/library";

export interface SettlementPlanItem {
  fromUserId: string;
  toUserId: string;
  amount: string;
}

export function simplifyDebts(netBalances: Map<string, Decimal>): SettlementPlanItem[] {
  const EPSILON = new Decimal("0.01");

  const creditors = [...netBalances.entries()]
    .filter(([, amt]) => amt.greaterThan(EPSILON))
    .map(([userId, amt]) => ({ userId, amount: amt }));

  const debtors = [...netBalances.entries()]
    .filter(([, amt]) => amt.lessThan(EPSILON.negated()))
    .map(([userId, amt]) => ({ userId, amount: amt.abs() }));

  creditors.sort((a, b) => b.amount.comparedTo(a.amount));
  debtors.sort((a, b) => b.amount.comparedTo(a.amount));

  const plan: SettlementPlanItem[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const settleAmount = Decimal.min(creditor.amount, debtor.amount);

    if (settleAmount.greaterThan(EPSILON)) {
      plan.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amount: settleAmount.toFixed(2) });
    }

    creditor.amount = creditor.amount.minus(settleAmount);
    debtor.amount = debtor.amount.minus(settleAmount);

    if (creditor.amount.lessThanOrEqualTo(EPSILON)) ci++;
    if (debtor.amount.lessThanOrEqualTo(EPSILON)) di++;
  }

  return plan;
}
