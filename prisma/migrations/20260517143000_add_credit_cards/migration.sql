-- Add user/workspace scoped credit cards without touching existing order data.
CREATE TABLE "CreditCard" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "workspaceId" TEXT,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "last4" TEXT,
  "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "utilizationWarningPercent" DOUBLE PRECISION NOT NULL DEFAULT 30,
  "cashbackOptions" JSONB,
  "defaultCashbackPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "creditCardId" TEXT;

CREATE UNIQUE INDEX "CreditCard_workspaceId_userId_name_key" ON "CreditCard"("workspaceId", "userId", "name");
CREATE INDEX "CreditCard_userId_idx" ON "CreditCard"("userId");
CREATE INDEX "CreditCard_workspaceId_idx" ON "CreditCard"("workspaceId");
CREATE INDEX "Order_creditCardId_idx" ON "Order"("creditCardId");

ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
