CREATE TYPE "PayoutMode" AS ENUM ('MANUAL', 'PERCENT_SPREAD');

ALTER TABLE "Order" ADD COLUMN "warehousePayoutPerUnit" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "warehouseTotalPayout" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "memberPayoutPerUnit" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "memberTotalPayout" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "adminSpreadPerUnit" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "adminTotalSpread" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "adminSpreadPercent" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "payoutMode" "PayoutMode" NOT NULL DEFAULT 'PERCENT_SPREAD';

UPDATE "Order"
SET
  "warehousePayoutPerUnit" = "payoutPerUnit",
  "warehouseTotalPayout" = "payoutPerUnit" * "quantity",
  "memberPayoutPerUnit" = COALESCE("memberPayoutAmount" / NULLIF("quantity", 0), "payoutPerUnit"),
  "memberTotalPayout" = COALESCE("memberPayoutAmount", "payoutPerUnit" * "quantity"),
  "adminSpreadPerUnit" = "payoutPerUnit" - COALESCE("memberPayoutAmount" / NULLIF("quantity", 0), "payoutPerUnit"),
  "adminTotalSpread" = ("payoutPerUnit" * "quantity") - COALESCE("memberPayoutAmount", "payoutPerUnit" * "quantity"),
  "adminSpreadPercent" = CASE
    WHEN "payoutPerUnit" * "quantity" > 0
      THEN (("payoutPerUnit" * "quantity") - COALESCE("memberPayoutAmount", "payoutPerUnit" * "quantity")) / ("payoutPerUnit" * "quantity")
    ELSE 0
  END;
