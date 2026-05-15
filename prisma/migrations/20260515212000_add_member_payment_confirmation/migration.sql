ALTER TABLE "Order" ADD COLUMN "memberConfirmedPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "memberConfirmedPaymentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "memberMarkedDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "memberMarkedDoneAt" TIMESTAMP(3);

UPDATE "Order"
SET
  "memberConfirmedPayment" = true,
  "memberConfirmedPaymentAt" = COALESCE("memberPaidAt", "adminPaidMemberAt", "creditCardPaidAt"),
  "memberMarkedDone" = true,
  "memberMarkedDoneAt" = COALESCE("profitReceivedAt", "memberPaidAt", "adminPaidMemberAt", "creditCardPaidAt")
WHERE "memberPaid" = true OR "adminPaidMember" = true OR "profitReceived" = true;

CREATE INDEX "Order_workspaceId_memberConfirmedPayment_idx" ON "Order"("workspaceId", "memberConfirmedPayment");
CREATE INDEX "Order_workspaceId_memberMarkedDone_idx" ON "Order"("workspaceId", "memberMarkedDone");
