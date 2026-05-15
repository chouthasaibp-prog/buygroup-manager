CREATE TABLE "DeliveryBeforeTrackingAlert" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "memberProfileId" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryBeforeTrackingAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryBeforeTrackingAlert_workspaceId_reviewedAt_snoozedUntil_idx" ON "DeliveryBeforeTrackingAlert"("workspaceId", "reviewedAt", "snoozedUntil");
CREATE INDEX "DeliveryBeforeTrackingAlert_workspaceId_createdAt_idx" ON "DeliveryBeforeTrackingAlert"("workspaceId", "createdAt");
CREATE INDEX "DeliveryBeforeTrackingAlert_orderId_idx" ON "DeliveryBeforeTrackingAlert"("orderId");
CREATE INDEX "DeliveryBeforeTrackingAlert_memberProfileId_idx" ON "DeliveryBeforeTrackingAlert"("memberProfileId");

ALTER TABLE "DeliveryBeforeTrackingAlert" ADD CONSTRAINT "DeliveryBeforeTrackingAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryBeforeTrackingAlert" ADD CONSTRAINT "DeliveryBeforeTrackingAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryBeforeTrackingAlert" ADD CONSTRAINT "DeliveryBeforeTrackingAlert_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
