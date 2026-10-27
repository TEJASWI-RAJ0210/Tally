-- Existing settlements were already treated as completed payments.
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "Settlement"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "initiatedById" TEXT,
  ADD COLUMN "status" "SettlementStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedById" TEXT;

-- Preserve historical balance behavior for records created before confirmation existed.
UPDATE "Settlement" SET "initiatedById" = "fromUserId";
ALTER TABLE "Settlement" ALTER COLUMN "initiatedById" SET NOT NULL;
ALTER TABLE "Settlement" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX "Settlement_idempotencyKey_key" ON "Settlement"("idempotencyKey");
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_initiatedById_fkey"
  FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "SettlementEventAction" AS ENUM ('CREATED', 'CONFIRMED', 'CANCELLED', 'LEGACY_CONFIRMED');
CREATE TABLE "SettlementEvent" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" "SettlementEventAction" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementEvent_pkey" PRIMARY KEY ("id")
);

-- Record old completed payments in the audit trail without treating the original payer as a second-party confirmer.
INSERT INTO "SettlementEvent" ("id", "settlementId", "actorId", "action", "note", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || s."id")::uuid::text,
       s."id", s."fromUserId", 'LEGACY_CONFIRMED', 'Imported historical settlement', s."createdAt"
FROM "Settlement" s;

CREATE INDEX "SettlementEvent_settlementId_createdAt_idx" ON "SettlementEvent"("settlementId", "createdAt");
ALTER TABLE "SettlementEvent" ADD CONSTRAINT "SettlementEvent_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementEvent" ADD CONSTRAINT "SettlementEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
