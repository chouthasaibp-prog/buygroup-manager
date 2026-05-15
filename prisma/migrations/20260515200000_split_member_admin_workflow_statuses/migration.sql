ALTER TABLE "Order" ADD COLUMN "memberSubmittedTrackingToAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "memberSubmittedTrackingToAdminAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "adminSubmittedTrackingToWarehouse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "adminSubmittedTrackingToWarehouseAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "memberMarkedDelivered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "memberMarkedDeliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "adminMarkedScannedByWarehouse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "adminMarkedScannedByWarehouseAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "adminReceivedPayoutFromWarehouse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "adminReceivedPayoutFromWarehouseAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "adminPaidMember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "adminPaidMemberAt" TIMESTAMP(3);

UPDATE "Order"
SET
  "memberSubmittedTrackingToAdmin" = "trackingNumber" IS NOT NULL,
  "memberSubmittedTrackingToAdminAt" = "trackingAddedAt",
  "adminSubmittedTrackingToWarehouse" = "trackingSubmitted" OR "adminSubmittedTrackingToBuyGroup",
  "adminSubmittedTrackingToWarehouseAt" = COALESCE("trackingSubmittedAt", "adminSubmittedTrackingToBuyGroupAt"),
  "memberMarkedDelivered" = "delivered",
  "memberMarkedDeliveredAt" = "deliveredAt",
  "adminMarkedScannedByWarehouse" = "scanned" OR "warehouseScanned",
  "adminMarkedScannedByWarehouseAt" = COALESCE("scannedAt", "warehouseScannedAt"),
  "adminReceivedPayoutFromWarehouse" = "paidOut" OR "buyGroupPaidAdmin",
  "adminReceivedPayoutFromWarehouseAt" = COALESCE("paidOutAt", "buyGroupPaidAdminAt"),
  "adminPaidMember" = "memberPaid" OR "creditCardPaid",
  "adminPaidMemberAt" = COALESCE("memberPaidAt", "creditCardPaidAt");
