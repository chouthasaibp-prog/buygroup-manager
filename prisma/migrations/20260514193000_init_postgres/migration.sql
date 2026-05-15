-- Initial Supabase Postgres schema for the Amazon Buy Group app.

CREATE TYPE "OrderStage" AS ENUM (
  'ORDERED',
  'TRACKING_READY',
  'TRACKING_SUBMITTED',
  'DELIVERED',
  'SCANNED',
  'PAID_OUT',
  'CREDIT_PAID',
  'PROFIT_RECEIVED'
);

CREATE TABLE "AmazonAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "defaultCreditCardDueDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AmazonAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BuyGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BuyGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "retailPrice" DOUBLE PRECISION NOT NULL,
  "payoutPerUnit" DOUBLE PRECISION NOT NULL,
  "chaseCashbackPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "youngAdultEligible" BOOLEAN NOT NULL DEFAULT false,
  "sameTracking" BOOLEAN NOT NULL DEFAULT false,
  "shippingType" TEXT,
  "orderNumber" TEXT,
  "trackingNumber" TEXT,
  "trackingSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "delivered" BOOLEAN NOT NULL DEFAULT false,
  "scanned" BOOLEAN NOT NULL DEFAULT false,
  "paidOut" BOOLEAN NOT NULL DEFAULT false,
  "creditCardPaid" BOOLEAN NOT NULL DEFAULT false,
  "profitReceived" BOOLEAN NOT NULL DEFAULT false,
  "currentStage" "OrderStage" NOT NULL DEFAULT 'ORDERED',
  "notes" TEXT,
  "manualCreditCardDueDate" TIMESTAMP(3),
  "payoutReminderSnoozedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trackingAddedAt" TIMESTAMP(3),
  "trackingSubmittedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "scannedAt" TIMESTAMP(3),
  "paidOutAt" TIMESTAMP(3),
  "creditCardPaidAt" TIMESTAMP(3),
  "profitReceivedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "amazonAccountId" TEXT,
  "buyGroupId" TEXT,
  "warehouseId" TEXT,

  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AmazonAccount_name_key" ON "AmazonAccount"("name");
CREATE UNIQUE INDEX "BuyGroup_name_key" ON "BuyGroup"("name");
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

CREATE INDEX "Order_currentStage_idx" ON "Order"("currentStage");
CREATE INDEX "Order_amazonAccountId_idx" ON "Order"("amazonAccountId");
CREATE INDEX "Order_buyGroupId_idx" ON "Order"("buyGroupId");
CREATE INDEX "Order_warehouseId_idx" ON "Order"("warehouseId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_amazonAccountId_fkey"
  FOREIGN KEY ("amazonAccountId") REFERENCES "AmazonAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_buyGroupId_fkey"
  FOREIGN KEY ("buyGroupId") REFERENCES "BuyGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
