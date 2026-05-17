PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS "AmazonAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "defaultCreditCardDueDays" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CreditCard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "workspaceId" TEXT,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "last4" TEXT,
  "creditLimit" REAL NOT NULL DEFAULT 0,
  "utilizationWarningPercent" REAL NOT NULL DEFAULT 30,
  "cashbackOptions" TEXT,
  "defaultCashbackPercent" REAL NOT NULL DEFAULT 5,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  "warehousePayoutPerUnit" REAL,
  "warehouseTotalPayout" REAL,
  "memberPayoutPerUnit" REAL,
  "memberTotalPayout" REAL,
  "adminSpreadPerUnit" REAL,
  "adminTotalSpread" REAL,
  "adminSpreadPercent" REAL,
  "payoutMode" TEXT NOT NULL DEFAULT 'PERCENT_SPREAD',
  "chaseCashbackPercent" REAL NOT NULL DEFAULT 0,
  "youngAdultEligible" BOOLEAN NOT NULL DEFAULT false,
  "youngAdultBalanceUsed" BOOLEAN NOT NULL DEFAULT false,
  "sameTracking" BOOLEAN NOT NULL DEFAULT false,
  "shippingType" TEXT,
  "orderNumber" TEXT,
  "trackingNumber" TEXT,
  "trackingSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "committedToWarehouse" BOOLEAN NOT NULL DEFAULT false,
  "delivered" BOOLEAN NOT NULL DEFAULT false,
  "scanned" BOOLEAN NOT NULL DEFAULT false,
  "paidOut" BOOLEAN NOT NULL DEFAULT false,
  "creditCardPaid" BOOLEAN NOT NULL DEFAULT false,
  "profitReceived" BOOLEAN NOT NULL DEFAULT false,
  "currentStage" TEXT NOT NULL DEFAULT 'ORDERED',
  "notes" TEXT,
  "manualCreditCardDueDate" DATETIME,
  "payoutReminderSnoozedAt" DATETIME,
  "archivedAt" DATETIME,
  "deletedAt" DATETIME,
  "deletedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trackingAddedAt" DATETIME,
  "trackingSubmittedAt" DATETIME,
  "deliveredAt" DATETIME,
  "scannedAt" DATETIME,
  "paidOutAt" DATETIME,
  "creditCardPaidAt" DATETIME,
  "profitReceivedAt" DATETIME,
  "committedToWarehouseAt" DATETIME,
  "adminCommittedToWarehouse" BOOLEAN NOT NULL DEFAULT false,
  "adminCommittedToWarehouseAt" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amazonAccountId" TEXT,
  "creditCardId" TEXT,
  "buyGroupId" TEXT,
  "warehouseId" TEXT,
  CONSTRAINT "Order_amazonAccountId_fkey" FOREIGN KEY ("amazonAccountId") REFERENCES "AmazonAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Order_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Order_buyGroupId_fkey" FOREIGN KEY ("buyGroupId") REFERENCES "BuyGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ReminderState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reviewedAt" DATETIME,
  "snoozedUntil" DATETIME,
  "lastSentAt" DATETIME,
  "resolvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReminderState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReminderState_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Order_currentStage_idx" ON "Order"("currentStage");
CREATE INDEX IF NOT EXISTS "Order_amazonAccountId_idx" ON "Order"("amazonAccountId");
CREATE INDEX IF NOT EXISTS "Order_creditCardId_idx" ON "Order"("creditCardId");
CREATE INDEX IF NOT EXISTS "Order_buyGroupId_idx" ON "Order"("buyGroupId");
CREATE INDEX IF NOT EXISTS "Order_warehouseId_idx" ON "Order"("warehouseId");
CREATE INDEX IF NOT EXISTS "CreditCard_userId_idx" ON "CreditCard"("userId");
CREATE INDEX IF NOT EXISTS "CreditCard_workspaceId_idx" ON "CreditCard"("workspaceId");
