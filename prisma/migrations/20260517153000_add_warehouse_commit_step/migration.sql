-- Add explicit warehouse/buy-group commit timestamps without changing existing workflow data.
ALTER TABLE "Order"
  ADD COLUMN "committedToWarehouse" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "committedToWarehouseAt" TIMESTAMP(3),
  ADD COLUMN "adminCommittedToWarehouse" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "adminCommittedToWarehouseAt" TIMESTAMP(3);

CREATE INDEX "Order_workspaceId_committedToWarehouse_idx" ON "Order"("workspaceId", "committedToWarehouse");
CREATE INDEX "Order_workspaceId_adminCommittedToWarehouse_idx" ON "Order"("workspaceId", "adminCommittedToWarehouse");
