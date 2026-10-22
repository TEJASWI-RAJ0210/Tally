export interface Share {
  userId: string;
  amountOwed: number;
}

export function calculateEqualSplit(totalAmount: number, participantIds: string[]): Share[] {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / participantIds.length);
  const remainder = totalCents - baseCents * participantIds.length;
  return participantIds.map((userId, i) => ({
    userId,
    amountOwed: (baseCents + (i === 0 ? remainder : 0)) / 100,
  }));
}

export function calculateExactSplit(amounts: Record<string, number>): Share[] {
  return Object.entries(amounts).map(([userId, amountOwed]) => ({
    userId,
    amountOwed: Math.round(amountOwed * 100) / 100,
  }));
}
