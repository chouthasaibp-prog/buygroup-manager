-- Soft-delete/archive metadata. Existing orders remain active because these fields default to NULL.
ALTER TABLE "Order"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedByUserId" TEXT;

CREATE INDEX "Order_workspaceId_deletedAt_idx" ON "Order"("workspaceId", "deletedAt");
CREATE INDEX "Order_workspaceId_archivedAt_idx" ON "Order"("workspaceId", "archivedAt");
