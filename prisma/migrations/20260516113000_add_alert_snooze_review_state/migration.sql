ALTER TABLE "TrackingChangeAlert" ADD COLUMN "snoozedUntil" TIMESTAMP(3);

CREATE TABLE "ReminderState" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReminderState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderState_orderId_type_key" ON "ReminderState"("orderId", "type");
CREATE INDEX "ReminderState_workspaceId_reviewedAt_snoozedUntil_idx" ON "ReminderState"("workspaceId", "reviewedAt", "snoozedUntil");
CREATE INDEX "ReminderState_workspaceId_orderId_idx" ON "ReminderState"("workspaceId", "orderId");
CREATE INDEX "TrackingChangeAlert_workspaceId_reviewedAt_snoozedUntil_idx" ON "TrackingChangeAlert"("workspaceId", "reviewedAt", "snoozedUntil");

ALTER TABLE "ReminderState" ADD CONSTRAINT "ReminderState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderState" ADD CONSTRAINT "ReminderState_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
