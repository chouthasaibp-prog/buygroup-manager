ALTER TABLE "WorkspaceMember"
  ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "slackNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reminderNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ReminderState"
  ADD COLUMN "lastSentAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "ReminderState_workspaceId_lastSentAt_idx" ON "ReminderState"("workspaceId", "lastSentAt");
CREATE INDEX "ReminderState_workspaceId_resolvedAt_idx" ON "ReminderState"("workspaceId", "resolvedAt");
