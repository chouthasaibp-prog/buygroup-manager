CREATE TABLE "TrackingChangeAlert" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "memberProfileId" TEXT,
  "oldTrackingNumber" TEXT,
  "newTrackingNumber" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "warehouseTrackingUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrackingChangeAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrackingChangeAlert_workspaceId_reviewedAt_idx" ON "TrackingChangeAlert"("workspaceId", "reviewedAt");
CREATE INDEX "TrackingChangeAlert_workspaceId_changedAt_idx" ON "TrackingChangeAlert"("workspaceId", "changedAt");
CREATE INDEX "TrackingChangeAlert_orderId_idx" ON "TrackingChangeAlert"("orderId");
CREATE INDEX "TrackingChangeAlert_memberProfileId_idx" ON "TrackingChangeAlert"("memberProfileId");

ALTER TABLE "TrackingChangeAlert" ADD CONSTRAINT "TrackingChangeAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingChangeAlert" ADD CONSTRAINT "TrackingChangeAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingChangeAlert" ADD CONSTRAINT "TrackingChangeAlert_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
