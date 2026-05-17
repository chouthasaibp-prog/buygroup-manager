import type { Order, Profile, ReminderState, Workspace, WorkspaceMember } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildReminders, calculateFinancials, calculatePayoutBreakdown, dateTime, money, type OrderWithRelations, type Reminder } from "@/lib/domain";

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
  creditCard: true,
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
      text: `*Action needed: ${input.title}*\nWorkspace: ${context.workspaceName ?? input.workspaceId}\n${input.message}`
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

function destinationName(order: OrderWithRelations) {
  return order.buyGroup?.name ?? order.warehouse?.name ?? order.warehouse?.code ?? "Not selected";
}

function payoutForReminder(order: OrderWithRelations, mode: "personal" | "member" | "admin") {
  const payout = calculatePayoutBreakdown(order);
  if (mode === "admin") return { perUnit: payout.warehousePayoutPerUnit, total: payout.warehouseTotalPayout };
  if (mode === "member") return { perUnit: payout.memberPayoutPerUnit, total: order.memberPayoutAmount ?? payout.memberTotalPayout };
  return { perUnit: order.payoutPerUnit, total: order.payoutPerUnit * order.quantity };
}

function relevantDateFor(reminder: Reminder, mode: "personal" | "member" | "admin") {
  const order = reminder.order;
  if (reminder.type === "check_delivery") return ["Tracking submitted", order.trackingSubmittedAt ?? order.trackingAddedAt];
  if (reminder.type === "check_scan") return ["Delivered", order.deliveredAt ?? order.memberMarkedDeliveredAt];
  if (reminder.type === "check_payout") return [mode === "admin" ? "Scanned by warehouse" : "Scanned", order.adminMarkedScannedByWarehouseAt ?? order.warehouseScannedAt ?? order.scannedAt];
  if (reminder.type === "pay_credit_card") return [mode === "admin" ? "Warehouse payout received" : mode === "member" ? "Payment confirmed" : "Payout received", order.adminReceivedPayoutFromWarehouseAt ?? order.paidOutAt ?? order.memberConfirmedPaymentAt];
  return ["Relevant date", null];
}

function reminderSubject(reminder: Reminder, mode: "personal" | "member" | "admin" = "personal") {
  const item = reminder.order.itemName;
  if (reminder.type === "commit_warehouse" && mode === "admin") return `Urgent: commit member order to warehouse: ${item}`;
  if (reminder.type === "commit_warehouse") return `Commit item to warehouse: ${item}`;
  if (reminder.type === "submit_tracking") return `Tracking needed: ${item}`;
  if (reminder.type === "check_delivery") return `Delivery check: ${item}`;
  if (reminder.type === "check_scan") return `Scan check: ${item}`;
  if (reminder.type === "check_payout") return `Payout check: ${item}`;
  if (reminder.type === "pay_credit_card") return `Pay credit card: ${item}`;
  return `${reminder.label}: ${item}`;
}

function reminderMessage(reminder: Reminder, mode: "personal" | "member" | "admin") {
  const order = reminder.order;
  const financials = calculateFinancials(order);
  const payout = payoutForReminder(order, mode);
  const [dateLabel, relevantDate] = relevantDateFor(reminder, mode);
  if (mode === "admin" && reminder.type === "commit_warehouse") {
    const payoutBreakdown = calculatePayoutBreakdown(order);
    return [
      `Member: ${order.submittedBy ? [order.submittedBy.firstName, order.submittedBy.lastName].filter(Boolean).join(" ").trim() || order.submittedBy.name || order.submittedBy.email : "Unknown member"}`,
      `Member email: ${order.submittedBy?.email ?? "Unknown"}`,
      `Item: ${order.itemName}`,
      `Quantity: ${order.quantity}`,
      `Retail: ${money(financials.totalPaid)} total / ${money(order.retailPrice)} per unit`,
      `Member payout: ${money(payoutBreakdown.memberTotalPayout)} total / ${money(payoutBreakdown.memberPayoutPerUnit)} per unit`,
      `Warehouse payout: ${money(payoutBreakdown.warehouseTotalPayout)} total / ${money(payoutBreakdown.warehousePayoutPerUnit)} per unit`,
      `Admin spread: ${money(payoutBreakdown.adminTotalSpread)}`,
      `Buy group: ${destinationName(order)}`,
      `Amazon account: ${order.amazonAccount?.name ?? "Not selected"}`,
      `Order #: ${order.orderNumber ?? "Not provided"}`,
      `Created: ${dateTime(order.createdAt)}`,
      "Action needed: Commit this member order to the warehouse/buy group"
    ].join("\n");
  }
  const lines = [
    `Item: ${order.itemName}`,
    `Quantity: ${order.quantity}`,
    `Retail: ${money(financials.totalPaid)} total / ${money(order.retailPrice)} per unit`,
    `Payout: ${money(payout.total)} total / ${money(payout.perUnit)} per unit`,
    `Amazon account: ${order.amazonAccount?.name ?? "Not selected"}`,
    `Buy group: ${destinationName(order)}`,
    `Order #: ${order.orderNumber ?? "Not provided"}`,
    `Tracking: ${order.trackingNumber ?? "Not submitted"}`,
    `Ordered: ${dateTime(order.createdAt)}`,
    `${dateLabel}: ${relevantDate ? dateTime(relevantDate) : "Not set"}`
  ];

  if (reminder.type === "pay_credit_card" || order.creditCard) {
    lines.push(`Credit card: ${order.creditCard?.name ?? "Not selected"}`);
  }
  if (reminder.type === "pay_credit_card") {
    lines.splice(1, 0, `Credit owed: ${money(financials.amountOwed)}`);
  }
  if (reminder.type === "commit_warehouse") {
    lines.push("Action needed: Commit this item to the warehouse/buy group");
  }
  if (reminder.notes) lines.push(`Note: ${reminder.notes}`);

  return lines.join("\n");
}

function isDoneForMode(order: OrderForNotifications, mode: "personal" | "member" | "admin") {
  if (mode === "admin") return order.adminPaidMember || order.memberPaid || order.profitReceived;
  if (mode === "member") return order.memberMarkedDone || order.profitReceived;
  return order.profitReceived;
}

function reminderCadenceHours(reminder: Reminder, mode: "personal" | "member" | "admin") {
  if (mode !== "personal") return null;
  if (reminder.type === "commit_warehouse") return 6;
  if (reminder.type === "submit_tracking") return 18;
  if (reminder.type === "check_delivery") return 18;
  if (reminder.type === "check_scan") return 12;
  if (reminder.type === "check_payout") return 18;
  if (reminder.type === "pay_credit_card") return 6;
  return null;
}

async function shouldSendReminder(reminder: Reminder, recipient: WorkspaceMember, now: Date, mode: "personal" | "member" | "admin", force = false) {
  const state = reminder.order.reminderStates?.find((item) => item.type === reminder.type);
  if (state?.reviewedAt || state?.resolvedAt) return false;
  if (state?.snoozedUntil && state.snoozedUntil > now) return false;
  if (!recipient.reminderNotificationsEnabled) return false;
  if (force) return true;
  if (!state?.lastSentAt) return true;
  const cadenceHours = reminderCadenceHours(reminder, mode);
  if (!cadenceHours) return false;
  return now.getTime() - state.lastSentAt.getTime() >= cadenceHours * 60 * 60 * 1000;
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

async function recentlySent(orderId: string, type: Reminder["type"], now: Date) {
  const state = await prisma.reminderState.findUnique({
    where: { orderId_type: { orderId, type } },
    select: { lastSentAt: true, reviewedAt: true, resolvedAt: true, snoozedUntil: true }
  });
  if (state?.reviewedAt || state?.resolvedAt) return true;
  if (state?.snoozedUntil && state.snoozedUntil > now) return true;
  return !!state?.lastSentAt && now.getTime() - state.lastSentAt.getTime() < 30_000;
}

async function resolveFixedReminderStates(order: OrderForNotifications) {
  const resolvedTypes = [
    order.amazonAccount ? "missing_amazon_account" : null,
    order.buyGroup || order.warehouse ? "missing_buy_group" : null,
    order.trackingNumber ? "submit_tracking" : null,
    order.committedToWarehouse || order.committedToWarehouseAt || order.adminCommittedToWarehouse || order.adminCommittedToWarehouseAt ? "commit_warehouse" : null,
    order.delivered ? "check_delivery" : null,
    order.scanned ? "check_scan" : null,
    order.adminReceivedPayoutFromWarehouse || order.paidOut ? "check_payout" : null,
    order.adminPaidMember || order.memberPaid || order.creditCardPaid ? "pay_credit_card" : null
  ].filter((value): value is string => !!value);

  if (resolvedTypes.length === 0) return;
  await prisma.reminderState.updateMany({
    where: { orderId: order.id, type: { in: resolvedTypes }, resolvedAt: null },
    data: { resolvedAt: new Date() }
  });
}

async function notifyRemindersForRecipient(recipient: MemberWithProfile, orders: OrderForNotifications[], mode: "personal" | "member" | "admin", now: Date, force = false) {
  const activeOrders = orders.filter((order) => !isDoneForMode(order, mode));
  await Promise.all(orders.map(resolveFixedReminderStates));
  const reminders = buildReminders(activeOrders, now, mode);
  let sent = 0;

  for (const reminder of reminders) {
    if (!(await shouldSendReminder(reminder, recipient, now, mode, force))) continue;
    await sendNotification({
      userId: recipient.profileId,
      workspaceId: recipient.workspaceId,
      orderId: reminder.order.id,
      type: reminder.type,
      title: reminderSubject(reminder, mode),
      message: reminderMessage(reminder, mode),
      severity: severityFor(reminder),
      channels: channelsForMember(recipient)
    });
    await markReminderSent(reminder, now);
    sent += 1;
  }

  return sent;
}

export async function runReminderNotificationCron(now = new Date(), options: { force?: boolean } = {}) {
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
    sent += await notifyRemindersForRecipient(membership, orders as OrderForNotifications[], mode, now, options.force ?? false);
  }

  return { sent };
}

export async function sendImmediatePersonalWorkflowNotifications({
  workspaceId,
  profileId,
  orderId,
  types,
  now = new Date()
}: {
  workspaceId: string;
  profileId: string;
  orderId: string;
  types: Reminder["type"][];
  now?: Date;
}) {
  if (types.length === 0) return 0;
  const [recipient, order] = await Promise.all([
    prisma.workspaceMember.findFirst({
      where: { workspaceId, profileId, status: "ACTIVE", reminderNotificationsEnabled: true },
      include: { profile: true, workspace: true }
    }),
    prisma.order.findFirst({
      where: { id: orderId, workspaceId, submittedByProfileId: profileId },
      include: reminderIncludes
    })
  ]);
  if (!recipient || !order || order.workspace?.type !== "PERSONAL" || isDoneForMode(order as OrderForNotifications, "personal")) return 0;

  const reminders = buildReminders([order as OrderForNotifications], now, "personal").filter((reminder) => types.includes(reminder.type));
  let sent = 0;
  for (const reminder of reminders) {
    if (await recentlySent(reminder.order.id, reminder.type, now)) continue;
    await sendNotification({
      userId: recipient.profileId,
      workspaceId: recipient.workspaceId,
      orderId: reminder.order.id,
      type: reminder.type,
      title: reminderSubject(reminder, "personal"),
      message: reminderMessage(reminder, "personal"),
      severity: severityFor(reminder),
      channels: channelsForMember(recipient)
    });
    await markReminderSent(reminder, now);
    sent += 1;
  }
  return sent;
}

export async function sendImmediateAdminCommitNotifications({
  workspaceId,
  orderId,
  now = new Date()
}: {
  workspaceId: string;
  orderId: string;
  now?: Date;
}) {
  const [recipients, order] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
        reminderNotificationsEnabled: true,
        role: { in: ["OWNER", "ADMIN"] }
      },
      include: { profile: true, workspace: true }
    }),
    prisma.order.findFirst({
      where: { id: orderId, workspaceId },
      include: reminderIncludes
    })
  ]);
  if (!order || order.workspace?.type !== "OPERATOR" || isDoneForMode(order as OrderForNotifications, "admin")) return 0;
  const reminders = buildReminders([order as OrderForNotifications], now, "admin").filter((reminder) => reminder.type === "commit_warehouse");
  if (reminders.length === 0) return 0;
  let sent = 0;
  for (const recipient of recipients) {
    for (const reminder of reminders) {
      if (await recentlySent(reminder.order.id, reminder.type, now)) continue;
      await sendNotification({
        userId: recipient.profileId,
        workspaceId: recipient.workspaceId,
        orderId: reminder.order.id,
        type: reminder.type,
        title: reminderSubject(reminder, "admin"),
        message: reminderMessage(reminder, "admin"),
        severity: severityFor(reminder),
        channels: channelsForMember(recipient)
      });
      sent += 1;
    }
  }
  if (sent > 0) await markReminderSent(reminders[0], now);
  return sent;
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
