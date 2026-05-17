import type { Order, OrderStage, ReminderState } from "@prisma/client";

export const stages: Array<{ key: OrderStage | "ALL"; label: string; short: string }> = [
  { key: "ALL", label: "All", short: "All" },
  { key: "ORDERED", label: "Waiting for Member Tracking", short: "Waiting for Member Tracking" },
  { key: "TRACKING_READY", label: "Tracking Received from Member", short: "Tracking Received from Member" },
  { key: "TRACKING_SUBMITTED", label: "Submitted to Warehouse", short: "Submitted to Warehouse" },
  { key: "DELIVERED", label: "Delivered by Member", short: "Delivered by Member" },
  { key: "SCANNED", label: "Scanned by Warehouse", short: "Scanned by Warehouse" },
  { key: "PAID_OUT", label: "Paid Out from Warehouse", short: "Paid Out from Warehouse" },
  { key: "CREDIT_PAID", label: "Paid to Member", short: "Paid to Member" },
  { key: "PROFIT_RECEIVED", label: "Done", short: "Done" }
];

export const stageLabels: Record<OrderStage, string> = {
  ORDERED: "Waiting for Member Tracking",
  TRACKING_READY: "Tracking Received from Member",
  TRACKING_SUBMITTED: "Submitted to Warehouse",
  DELIVERED: "Delivered by Member",
  SCANNED: "Scanned by Warehouse",
  PAID_OUT: "Paid Out from Warehouse",
  CREDIT_PAID: "Paid to Member",
  PROFIT_RECEIVED: "Done"
};

export type OrderWithRelations = Order & {
  amazonAccount: { id: string; name: string; defaultCreditCardDueDays: number | null } | null;
  buyGroup: { id: string; name: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  submittedBy?: { id: string; name: string | null; firstName: string | null; lastName: string | null; email: string } | null;
  reminderStates?: ReminderState[];
};

export type Financials = {
  totalPaid: number;
  totalPayout: number;
  payoutDifference: number;
  chaseCashback: number;
  youngAdultCashback: number;
  youngAdultBalanceApplied: number;
  totalCashback: number;
  mainProfit: number;
  youngAdultProfit: number;
  amountOwed: number;
  profit: number;
};

export type PayoutBreakdown = {
  warehousePayoutPerUnit: number;
  warehouseTotalPayout: number;
  memberPayoutPerUnit: number;
  memberTotalPayout: number;
  adminSpreadPerUnit: number;
  adminTotalSpread: number;
  adminSpreadPercent: number;
};

type PayoutFields = Pick<Order, "quantity" | "payoutPerUnit"> & {
  warehousePayoutPerUnit?: number | null;
  warehouseTotalPayout?: number | null;
  memberPayoutPerUnit?: number | null;
  memberTotalPayout?: number | null;
  adminSpreadPerUnit?: number | null;
  adminTotalSpread?: number | null;
  adminSpreadPercent?: number | null;
};

export function calculatePayoutBreakdown(order: PayoutFields): PayoutBreakdown {
  const warehousePayoutPerUnit = order.warehousePayoutPerUnit ?? order.payoutPerUnit;
  const memberPayoutPerUnit = order.memberPayoutPerUnit ?? order.payoutPerUnit;
  const warehouseTotalPayout = order.warehouseTotalPayout ?? warehousePayoutPerUnit * order.quantity;
  const memberTotalPayout = order.memberTotalPayout ?? memberPayoutPerUnit * order.quantity;
  const adminTotalSpread = order.adminTotalSpread ?? warehouseTotalPayout - memberTotalPayout;
  const adminSpreadPerUnit = order.adminSpreadPerUnit ?? warehousePayoutPerUnit - memberPayoutPerUnit;
  const adminSpreadPercent = warehouseTotalPayout > 0 ? adminTotalSpread / warehouseTotalPayout : order.adminSpreadPercent ?? 0;

  return { warehousePayoutPerUnit, warehouseTotalPayout, memberPayoutPerUnit, memberTotalPayout, adminSpreadPerUnit, adminTotalSpread, adminSpreadPercent };
}

export function calculateFinancials(order: Pick<Order, "retailPrice" | "quantity" | "payoutPerUnit" | "chaseCashbackPercent" | "youngAdultEligible"> & { youngAdultBalanceUsed?: boolean; memberPayoutPerUnit?: number | null; memberTotalPayout?: number | null }): Financials {
  const totalPaid = order.retailPrice * order.quantity;
  const totalPayout = order.memberTotalPayout ?? (order.memberPayoutPerUnit ?? order.payoutPerUnit) * order.quantity;
  const payoutDifference = totalPayout - totalPaid;
  const youngAdultBalanceApplied = order.youngAdultBalanceUsed ? totalPaid : 0;
  const chaseCashback = order.youngAdultBalanceUsed ? 0 : totalPaid * (order.chaseCashbackPercent / 100);
  const youngAdultCashback = order.youngAdultBalanceUsed || !order.youngAdultEligible ? 0 : totalPaid * 0.05;
  const totalCashback = chaseCashback + youngAdultCashback;
  const mainProfit = order.youngAdultBalanceUsed ? 0 : chaseCashback + payoutDifference;
  const youngAdultProfit = youngAdultCashback;
  const amountOwed = order.youngAdultBalanceUsed ? 0 : Math.max(0, totalPaid - chaseCashback);
  const profit = mainProfit + youngAdultProfit;

  return { totalPaid, totalPayout, payoutDifference, chaseCashback, youngAdultCashback, youngAdultBalanceApplied, totalCashback, mainProfit, youngAdultProfit, amountOwed, profit };
}

type StageFields = Pick<Order,
  "trackingNumber" |
  "trackingSubmitted" |
  "delivered" |
  "scanned" |
  "paidOut" |
  "creditCardPaid" |
  "profitReceived" |
  "memberPaid" |
  "memberSubmittedTrackingToAdmin" |
  "adminSubmittedTrackingToWarehouse" |
  "memberMarkedDelivered" |
  "adminMarkedScannedByWarehouse" |
  "adminReceivedPayoutFromWarehouse" |
  "adminPaidMember"
>;

export function deriveStage(order: StageFields): OrderStage {
  if (order.adminPaidMember || order.memberPaid || order.profitReceived) return "PROFIT_RECEIVED";
  if (order.creditCardPaid) return "CREDIT_PAID";
  if (order.adminReceivedPayoutFromWarehouse || order.paidOut) return "PAID_OUT";
  if (order.adminMarkedScannedByWarehouse || order.scanned) return "SCANNED";
  if (order.memberMarkedDelivered || order.delivered) return "DELIVERED";
  if (order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted) return "TRACKING_SUBMITTED";
  if (order.memberSubmittedTrackingToAdmin || order.trackingNumber?.trim()) return "TRACKING_READY";
  return "ORDERED";
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

export function shortDate(date: Date | string | null | undefined) {
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}

export function dateTime(date: Date | string | null | undefined) {
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export type Reminder = {
  id: string;
  type: "submit_tracking" | "check_payout" | "pay_credit_card" | "confirm_profit" | "missing_info" | "missing_amazon_account" | "missing_buy_group";
  label: string;
  dueDate: Date;
  order: OrderWithRelations;
  severity: "overdue" | "today" | "upcoming";
  priority?: "high" | "warning" | "normal";
  action: string;
  notes?: string;
};

function reminderHidden(order: OrderWithRelations, type: Reminder["type"], now: Date) {
  const state = order.reminderStates?.find((item) => item.type === type);
  return !!state?.reviewedAt || !!(state?.snoozedUntil && state.snoozedUntil > now);
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export function buildReminders(orders: OrderWithRelations[], now = new Date(), viewMode: "personal" | "member" | "admin" = "personal"): Reminder[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = addDays(startOfToday, 1);

  const severityFor = (dueDate: Date): Reminder["severity"] => {
    if (dueDate < startOfToday) return "overdue";
    if (dueDate < endOfToday) return "today";
    return "upcoming";
  };

  const reminders: Reminder[] = [];

  for (const order of orders) {
    const missingAccountRequested = !!order.reminderStates?.find((item) => item.type === "missing_amazon_account");
    const missingBuyGroupRequested = !!order.reminderStates?.find((item) => item.type === "missing_buy_group");

    if (!order.amazonAccount && viewMode === "admin" && !reminderHidden(order, "missing_amazon_account", now)) {
      reminders.push({
        id: `${order.id}:missing-account`,
        type: "missing_amazon_account",
        label: "Amazon account missing",
        dueDate: order.createdAt,
        order,
        severity: severityFor(order.createdAt),
        priority: "warning",
        action: "Request account from member",
        notes: "Amazon account missing"
      });
    }

    if (!order.amazonAccount && viewMode === "member" && missingAccountRequested && !reminderHidden(order, "missing_amazon_account", now)) {
      reminders.push({
        id: `${order.id}:missing-account`,
        type: "missing_amazon_account",
        label: "Amazon account missing",
        dueDate: order.createdAt,
        order,
        severity: severityFor(order.createdAt),
        priority: "warning",
        action: "Update Amazon account",
        notes: "Please update the Amazon account used for this order."
      });
    }

    if (!order.buyGroup && !order.warehouse && viewMode === "admin" && !reminderHidden(order, "missing_buy_group", now)) {
      reminders.push({
        id: `${order.id}:missing-buy-group`,
        type: "missing_buy_group",
        label: "Buy group / destination missing",
        dueDate: order.createdAt,
        order,
        severity: severityFor(order.createdAt),
        priority: "high",
        action: "Request buy group from member",
        notes: "Buy group / destination missing"
      });
    }

    if (!order.buyGroup && !order.warehouse && viewMode === "member" && missingBuyGroupRequested && !reminderHidden(order, "missing_buy_group", now)) {
      reminders.push({
        id: `${order.id}:missing-buy-group`,
        type: "missing_buy_group",
        label: "Buy group / destination missing",
        dueDate: order.createdAt,
        order,
        severity: severityFor(order.createdAt),
        priority: "high",
        action: "Update buy group / destination",
        notes: "Please update the buy group / destination for this order."
      });
    }

    const missing = viewMode === "personal" ? [
      !order.orderNumber && "order number",
      !order.amazonAccount && "Amazon account",
      !order.buyGroup && !order.warehouse && "buy group"
    ].filter(Boolean) : [
      !order.orderNumber && "order number"
    ].filter(Boolean);

    if (missing.length > 0 && !reminderHidden(order, "missing_info", now)) {
      const dueDate = order.createdAt;
      reminders.push({
        id: `${order.id}:missing`,
        type: "missing_info",
        label: "Missing info",
        dueDate,
        order,
        severity: severityFor(dueDate),
        action: "Complete order details",
        notes: `Missing ${missing.join(", ")}`
      });
    }

    const done = order.adminPaidMember || order.memberPaid || order.profitReceived;
    const trackingSubmittedForWorkflow = viewMode === "admin"
      ? order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted
      : order.trackingSubmitted;

    if (viewMode !== "member" && !done && !trackingSubmittedForWorkflow && !reminderHidden(order, "submit_tracking", now)) {
      const dueDate = order.trackingNumber ? order.trackingAddedAt ?? now : addDays(order.createdAt, 1);
      reminders.push({
        id: `${order.id}:tracking`,
        type: "submit_tracking",
        label: order.trackingNumber ? viewMode === "admin" ? "Submit tracking to warehouse" : "Submit tracking" : "Tracking missing",
        dueDate,
        order,
        severity: severityFor(dueDate),
        action: order.trackingNumber ? viewMode === "admin" ? "Submit to warehouse" : "Submit tracking" : "Add tracking"
      });
    }

    if (viewMode !== "member" && !done && (order.memberMarkedDelivered || order.delivered) && (order.adminMarkedScannedByWarehouse || order.scanned) && !(order.adminReceivedPayoutFromWarehouse || order.paidOut) && !reminderHidden(order, "check_payout", now)) {
      const baseDueDate = addDays(order.memberMarkedDeliveredAt ?? order.deliveredAt ?? order.updatedAt, 2);
      const dueDate = order.payoutReminderSnoozedAt && order.payoutReminderSnoozedAt > baseDueDate ? order.payoutReminderSnoozedAt : baseDueDate;
      reminders.push({
        id: `${order.id}:payout`,
        type: "check_payout",
        label: "Check payout",
        dueDate,
        order,
        severity: severityFor(dueDate),
        action: "Mark paid out"
      });
    }

    if (viewMode === "admin" && !done && (order.adminReceivedPayoutFromWarehouse || order.paidOut) && !(order.adminPaidMember || order.memberPaid) && !reminderHidden(order, "pay_credit_card", now)) {
      const dueDate =
        order.manualCreditCardDueDate ??
        addDays(order.adminReceivedPayoutFromWarehouseAt ?? order.paidOutAt ?? order.updatedAt, order.amazonAccount?.defaultCreditCardDueDays ?? 7);
      reminders.push({
        id: `${order.id}:card`,
        type: "pay_credit_card",
        label: "Pay member",
        dueDate,
        order,
        severity: severityFor(dueDate),
        action: "Mark paid to member"
      });
    }

  }

  return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
