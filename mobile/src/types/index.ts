export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Group {
  id: string;
  name: string;
  avatarUrl?: string | null;
  members: Array<{ user: User }>;
}

export type SplitType = "EQUAL" | "EXACT";

export interface Expense {
  id: string;
  description: string;
  amount: string;
  category?: string | null;
  date: string;
  groupId?: string | null;
  paidById: string;
  paidBy: User;
  splitType: SplitType;
  shares: Array<{ userId: string; amountOwed: string }>;
}

export interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: string;
  groupId?: string | null;
  date: string;
  note?: string | null;
}
