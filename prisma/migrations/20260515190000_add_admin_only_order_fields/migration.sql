ALTER TABLE "Order" ADD COLUMN "adminSubmittedTrackingToBuyGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "adminSubmittedTrackingToBuyGroupAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "warehouseScanned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "warehouseScannedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "buyGroupPaidAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "buyGroupPaidAdminAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "adminProfit" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "adminMargin" DOUBLE PRECISION;

UPDATE "Order"
SET
  "adminSubmittedTrackingToBuyGroup" = "trackingSubmitted",
  "adminSubmittedTrackingToBuyGroupAt" = "trackingSubmittedAt",
  "warehouseScanned" = "scanned",
  "warehouseScannedAt" = "scannedAt",
  "buyGroupPaidAdmin" = "paidOut",
  "buyGroupPaidAdminAt" = "paidOutAt";
