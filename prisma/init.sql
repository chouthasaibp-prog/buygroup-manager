PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS "AmazonAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "defaultCreditCardDueDays" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BuyGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Warehouse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "code" TEXT NOT NULL UNIQUE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "retailPrice" REAL NOT NULL,
  "payoutPerUnit" REAL NOT NULL,
  "chaseCashbackPercent" REAL NOT NULL DEFAULT 0,
  "youngAdultEligible" BOOLEAN NOT NULL DEFAULT false,
  "youngAdultBalanceUsed" BOOLEAN NOT NULL DEFAULT false,
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
  "currentStage" TEXT NOT NULL DEFAULT 'ORDERED',
  "notes" TEXT,
  "manualCreditCardDueDate" DATETIME,
  "payoutReminderSnoozedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trackingAddedAt" DATETIME,
  "trackingSubmittedAt" DATETIME,
  "deliveredAt" DATETIME,
  "scannedAt" DATETIME,
  "paidOutAt" DATETIME,
  "creditCardPaidAt" DATETIME,
  "profitReceivedAt" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amazonAccountId" TEXT,
  "buyGroupId" TEXT,
  "warehouseId" TEXT,
  CONSTRAINT "Order_amazonAccountId_fkey" FOREIGN KEY ("amazonAccountId") REFERENCES "AmazonAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Order_buyGroupId_fkey" FOREIGN KEY ("buyGroupId") REFERENCES "BuyGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Order_currentStage_idx" ON "Order"("currentStage");
CREATE INDEX IF NOT EXISTS "Order_amazonAccountId_idx" ON "Order"("amazonAccountId");
CREATE INDEX IF NOT EXISTS "Order_buyGroupId_idx" ON "Order"("buyGroupId");
CREATE INDEX IF NOT EXISTS "Order_warehouseId_idx" ON "Order"("warehouseId");
