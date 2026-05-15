-- Operator workspace architecture. This migration is non-destructive:
-- existing app data remains in place and can be assigned with
-- npm run make-workspace-owner -- <authUserId> <workspaceName>.

CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'OPERATOR');
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "WorkspaceMemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');

CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "authUserId" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "WorkspaceType" NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "inviteCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "status" "WorkspaceMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AmazonAccount" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "BuyGroup" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Warehouse" ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "Order" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Order" ADD COLUMN "submittedByProfileId" TEXT;
ALTER TABLE "Order" ADD COLUMN "createdByProfileId" TEXT;
ALTER TABLE "Order" ADD COLUMN "assignedOperatorProfileId" TEXT;
ALTER TABLE "Order" ADD COLUMN "memberPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "memberPaidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "memberPayoutAmount" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "memberVisibleNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "internalAdminNotes" TEXT;

CREATE UNIQUE INDEX "Profile_authUserId_key" ON "Profile"("authUserId");
CREATE INDEX "Profile_email_idx" ON "Profile"("email");

CREATE UNIQUE INDEX "Workspace_inviteCode_key" ON "Workspace"("inviteCode");
CREATE INDEX "Workspace_ownerProfileId_idx" ON "Workspace"("ownerProfileId");
CREATE INDEX "Workspace_type_idx" ON "Workspace"("type");

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_profileId_key" ON "WorkspaceMember"("workspaceId", "profileId");
CREATE INDEX "WorkspaceMember_profileId_idx" ON "WorkspaceMember"("profileId");
CREATE INDEX "WorkspaceMember_workspaceId_role_idx" ON "WorkspaceMember"("workspaceId", "role");
CREATE INDEX "WorkspaceMember_workspaceId_status_idx" ON "WorkspaceMember"("workspaceId", "status");

CREATE UNIQUE INDEX "AmazonAccount_workspaceId_name_key" ON "AmazonAccount"("workspaceId", "name");
CREATE INDEX "AmazonAccount_workspaceId_idx" ON "AmazonAccount"("workspaceId");

CREATE UNIQUE INDEX "BuyGroup_workspaceId_name_key" ON "BuyGroup"("workspaceId", "name");
CREATE INDEX "BuyGroup_workspaceId_idx" ON "BuyGroup"("workspaceId");

CREATE UNIQUE INDEX "Warehouse_workspaceId_name_key" ON "Warehouse"("workspaceId", "name");
CREATE UNIQUE INDEX "Warehouse_workspaceId_code_key" ON "Warehouse"("workspaceId", "code");
CREATE INDEX "Warehouse_workspaceId_idx" ON "Warehouse"("workspaceId");

CREATE INDEX "Order_workspaceId_idx" ON "Order"("workspaceId");
CREATE INDEX "Order_submittedByProfileId_idx" ON "Order"("submittedByProfileId");
CREATE INDEX "Order_createdByProfileId_idx" ON "Order"("createdByProfileId");
CREATE INDEX "Order_assignedOperatorProfileId_idx" ON "Order"("assignedOperatorProfileId");
CREATE INDEX "Order_workspaceId_submittedByProfileId_idx" ON "Order"("workspaceId", "submittedByProfileId");
CREATE INDEX "Order_workspaceId_memberPaid_idx" ON "Order"("workspaceId", "memberPaid");

ALTER TABLE "Workspace"
  ADD CONSTRAINT "Workspace_ownerProfileId_fkey"
  FOREIGN KEY ("ownerProfileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AmazonAccount"
  ADD CONSTRAINT "AmazonAccount_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BuyGroup"
  ADD CONSTRAINT "BuyGroup_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Warehouse"
  ADD CONSTRAINT "Warehouse_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_submittedByProfileId_fkey"
  FOREIGN KEY ("submittedByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_assignedOperatorProfileId_fkey"
  FOREIGN KEY ("assignedOperatorProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMember" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile"
  ON "Profile"
  FOR SELECT
  TO authenticated
  USING ("authUserId" = auth.uid()::text);

CREATE POLICY "Users can update their own profile"
  ON "Profile"
  FOR UPDATE
  TO authenticated
  USING ("authUserId" = auth.uid()::text)
  WITH CHECK ("authUserId" = auth.uid()::text);

CREATE POLICY "Workspace members can read their workspaces"
  ON "Workspace"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "Workspace"."id"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can read own membership"
  ON "WorkspaceMember"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Profile" p
      WHERE p."id" = "WorkspaceMember"."profileId"
        AND p."authUserId" = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM "WorkspaceMember" admin_membership
      JOIN "Profile" p ON p."id" = admin_membership."profileId"
      WHERE admin_membership."workspaceId" = "WorkspaceMember"."workspaceId"
        AND admin_membership."status" = 'ACTIVE'
        AND admin_membership."role" IN ('OWNER', 'ADMIN')
        AND p."authUserId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can manage their own amazon accounts" ON "AmazonAccount";
DROP POLICY IF EXISTS "Users can manage their own buy groups" ON "BuyGroup";
DROP POLICY IF EXISTS "Users can manage their own warehouses" ON "Warehouse";
DROP POLICY IF EXISTS "Users can manage their own orders" ON "Order";

CREATE POLICY "Workspace members can access workspace amazon accounts"
  ON "AmazonAccount"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "AmazonAccount"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "AmazonAccount"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can access workspace buy groups"
  ON "BuyGroup"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "BuyGroup"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "BuyGroup"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can access workspace warehouses"
  ON "Warehouse"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "Warehouse"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "Warehouse"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
    )
  );

CREATE POLICY "Workspace roles can access allowed orders"
  ON "Order"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "Order"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
        AND (
          wm."role" IN ('OWNER', 'ADMIN')
          OR "Order"."submittedByProfileId" = p."id"
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "WorkspaceMember" wm
      JOIN "Profile" p ON p."id" = wm."profileId"
      WHERE wm."workspaceId" = "Order"."workspaceId"
        AND wm."status" = 'ACTIVE'
        AND p."authUserId" = auth.uid()::text
        AND (
          wm."role" IN ('OWNER', 'ADMIN')
          OR "Order"."submittedByProfileId" = p."id"
        )
    )
  );
