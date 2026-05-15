-- Add Supabase Auth ownership columns and enable row level security.
-- Existing rows are preserved with a NULL owner until explicitly assigned.

ALTER TABLE "AmazonAccount" ADD COLUMN "userId" TEXT;
ALTER TABLE "BuyGroup" ADD COLUMN "userId" TEXT;
ALTER TABLE "Warehouse" ADD COLUMN "userId" TEXT;
ALTER TABLE "Order" ADD COLUMN "userId" TEXT;

DROP INDEX IF EXISTS "AmazonAccount_name_key";
DROP INDEX IF EXISTS "BuyGroup_name_key";
DROP INDEX IF EXISTS "Warehouse_name_key";
DROP INDEX IF EXISTS "Warehouse_code_key";

CREATE UNIQUE INDEX "AmazonAccount_userId_name_key" ON "AmazonAccount"("userId", "name");
CREATE INDEX "AmazonAccount_userId_idx" ON "AmazonAccount"("userId");

CREATE UNIQUE INDEX "BuyGroup_userId_name_key" ON "BuyGroup"("userId", "name");
CREATE INDEX "BuyGroup_userId_idx" ON "BuyGroup"("userId");

CREATE UNIQUE INDEX "Warehouse_userId_name_key" ON "Warehouse"("userId", "name");
CREATE UNIQUE INDEX "Warehouse_userId_code_key" ON "Warehouse"("userId", "code");
CREATE INDEX "Warehouse_userId_idx" ON "Warehouse"("userId");

CREATE INDEX "Order_userId_idx" ON "Order"("userId");

ALTER TABLE "AmazonAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BuyGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own amazon accounts"
  ON "AmazonAccount"
  FOR ALL
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can manage their own buy groups"
  ON "BuyGroup"
  FOR ALL
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can manage their own warehouses"
  ON "Warehouse"
  FOR ALL
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can manage their own orders"
  ON "Order"
  FOR ALL
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);
