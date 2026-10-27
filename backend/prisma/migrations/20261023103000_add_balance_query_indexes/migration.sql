CREATE INDEX "Friendship_friendId_status_createdAt_idx" ON "Friendship"("friendId", "status", "createdAt");
CREATE INDEX "Friendship_userId_status_createdAt_idx" ON "Friendship"("userId", "status", "createdAt");
CREATE INDEX "Expense_groupId_deletedAt_idx" ON "Expense"("groupId", "deletedAt");
CREATE INDEX "Expense_paidById_groupId_deletedAt_idx" ON "Expense"("paidById", "groupId", "deletedAt");
CREATE INDEX "ExpenseShare_userId_expenseId_idx" ON "ExpenseShare"("userId", "expenseId");
CREATE INDEX "Settlement_groupId_status_idx" ON "Settlement"("groupId", "status");
CREATE INDEX "Settlement_fromUserId_groupId_status_idx" ON "Settlement"("fromUserId", "groupId", "status");
CREATE INDEX "Settlement_toUserId_groupId_status_idx" ON "Settlement"("toUserId", "groupId", "status");
