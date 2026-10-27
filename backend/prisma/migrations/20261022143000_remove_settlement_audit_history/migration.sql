-- Keep settlement confirmation simple; remove the separate event audit trail.
DROP TABLE IF EXISTS "SettlementEvent";
DROP TYPE IF EXISTS "SettlementEventAction";
ALTER TABLE "Settlement" DROP COLUMN IF EXISTS "resolutionNote";
