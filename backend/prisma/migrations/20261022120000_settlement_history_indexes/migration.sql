CREATE INDEX "Settlement_fromUserId_date_idx" ON "Settlement"("fromUserId", "date");
CREATE INDEX "Settlement_toUserId_date_idx" ON "Settlement"("toUserId", "date");
CREATE INDEX "Settlement_groupId_date_idx" ON "Settlement"("groupId", "date");
