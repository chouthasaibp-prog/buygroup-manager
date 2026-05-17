import type { Order, Profile, ReminderState, Workspace, WorkspaceMember } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildReminders, type OrderWithRelations, type Reminder } from "@/lib/domain";

type Channel = "in-app" | "email" | "slack";
type Severity = "info" | "warning" | "high";

type SendNotificationInput = {
  userId: string;
  workspaceId: string;
  orderId?: string | null;
  type: string;
  title: string;
  message: string;
  severity: Severity;
  channels?: Channel[];
};

type MemberWithProfile = WorkspaceMember & { profile: Profile; workspace: Workspace };
type OrderForNotifications = OrderWithRelations & { workspace: Workspace | null };

const reminderIncludes = {
  amazonAccount: true,
  buyGroup: true,
  warehouse: true,
  submittedBy: true,
  workspace: true,
  reminderStates: true
} as const;

async function sendEmail(to: string, title: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: title,
      text: message
    })
  });

  if (!response.ok) {
    throw new Error(`Resend failed with ${response.status}: ${await response.text()}`);
  }
}

async function sendSlack(input: SendNotificationInput, context: { orderName?: string; workspaceName?: string }) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${input.title}*\nSeverity: ${input.severity}\nWorkspace: ${context.workspaceName ?? input.workspaceId}\nOrder: ${context.orderName ?? input.orderId ?? "N/A"}\nAction needed: ${input.message}`
    })
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed with ${response.status}: ${await response.text()}`);
  }
}

export async function sendNotification(input: SendNotificationInput) {
  const channels = input.channels ?? ["in-app"];
  const [profile, order, workspace] = await Promise.all([
    prisma.profile.findUnique({ where: { id: input.userId } }),
    input.orderId ? prisma.order.findUnique({ where: { id: input.orderId }, select: { itemName: true } }) : null,
    prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { name: true } })
  ]);

  if (!profile) return;

  if (channels.includes("email")) {
    try {
      await sendEmail(profile.email, input.title, input.message);
    } catch (error) {
      console.error("Email notification failed", error);
    }
  }

  if (channels.includes("slack")) {
    try {
      await sendSlack(input, { orderName: order?.itemName, workspaceName: workspace?.name });
    } catch (error) {
      console.error("Slack notification failed", error);
    }
  }
}

function channelsForMember(member: WorkspaceMember): Channel[] {
  const channels: Channel[] = ["in-app"];
  if (member.emailNotificationsEnabled) channels.push("email");
  if (member.slackNotificationsEnabled && process.env.SLACK_WEBHOOK_URL) channels.push("slack");
  return channels;
}

function severityFor(reminder: Reminder): Severity {
  if (reminder.priority === "high" || reminder.severity === "overdue") return "high";
  if (reminder.priority === "warning" || reminder.severity === "today") return "warning";
  return "info";
}

function reminderMessage(reminder: Reminder) {
  return reminder.notes ? `${reminder.action}. ${reminder.notes}` : reminder.action;
}

function isDoneForMode(order: OrderForNotifications, mode: "personal" | "member" | "admin") {
  if (mode === "admin") return order.adminPaidMember || order.memberPaid || order.profitReceived;
  if (mode === "member") return order.memberMarkedDone || order.profitReceived;
  return order.profitReceived;
}

async function shouldSendReminder(reminder: Reminder, recipient: WorkspaceMember, now: Date) {
  const state = reminder.order.reminderStates?.find((item) => item.type === reminder.type);
  if (state?.reviewedAt || state?.resolvedAt) return false;
  if (state?.snoozedUntil && state.snoozedUntil > now) return false;
  if (state?.lastSentAt) return false;
  if (!recipient.reminderNotificationsEnabled) return false;
  return true;
}

async function markReminderSent(reminder: Reminder, now: Date) {
  await prisma.reminderState.upsert({
    where: { orderId_type: { orderId: reminder.order.id, type: reminder.type } },
    update: { lastSentAt: now, resolvedAt: null },
    create: {
      workspaceId: reminder.order.workspaceId ?? "",
      orderId: reminder.order.id,
      type: reminder.type,
      lastSentAt: now
    }
  });
}

async function resolveFixedReminderStates(order: OrderForNotifications) {
  const resolvedTypes = [
    order.amazonAccount ? "missing_amazon_account" : null,
    order.buyGroup || order.warehouse ? "missing_buy_group" : null,
    order.trackingNumber ? "submit_tracking" : null,
    order.adminReceivedPayoutFromWarehouse || order.paidOut ? "check_payout" : null,
    order.adminPaidMember || order.memberPaid || order.creditCardPaid ? "pay_credit_card" : null
  ].filter((value): value is string => !!value);

  if (resolvedTypes.length === 0) return;
  await prisma.reminderState.updateMany({
    where: { orderId: order.id, type: { in: resolvedTypes }, resolvedAt: null },
    data: { resolvedAt: new Date() }
  });
}

async function notifyRemindersForRecipient(recipient: MemberWithProfile, orders: OrderForNotifications[], mode: "personal" | "member" | "admin", now: Date) {
  const activeOrders = orders.filter((order) => !isDoneForMode(order, mode));
  await Promise.all(orders.map(resolveFixedReminderStates));
  const reminders = buildReminders(activeOrders, now, mode);
  let sent = 0;

  for (const reminder of reminders) {
    if (!(await shouldSendReminder(reminder, recipient, now))) continue;
    await sendNotification({
      userId: recipient.profileId,
      workspaceId: recipient.workspaceId,
      orderId: reminder.order.id,
      type: reminder.type,
      title: reminder.label,
      message: reminderMessage(reminder),
      severity: severityFor(reminder),
      channels: channelsForMember(recipient)
    });
    await markReminderSent(reminder, now);
    sent += 1;
  }

  return sent;
}

export async function runReminderNotificationCron(now = new Date()) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { status: "ACTIVE", reminderNotificationsEnabled: true },
    include: { profile: true, workspace: true }
  });
  let sent = 0;

  for (const membership of memberships) {
    const mode = membership.workspace.type === "PERSONAL" ? "personal" : membership.role === "OWNER" || membership.role === "ADMIN" ? "admin" : "member";
    const orders = await prisma.order.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...(mode === "member" ? { submittedByProfileId: membership.profileId } : {})
      },
      include: reminderIncludes
    });
    sent += await notifyRemindersForRecipient(membership, orders as OrderForNotifications[], mode, now);
  }

  return { sent };
}

export async function sendTestNotification(profileId: string, workspaceId: string, channel: "email" | "slack") {
  await sendNotification({
    userId: profileId,
    workspaceId,
    type: `test_${channel}`,
    title: channel === "email" ? "Test email notification" : "Test Slack notification",
    message: "This is a test notification from Buy Group Ops.",
    severity: "info",
    channels: [channel]
  });
}
