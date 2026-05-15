import type { Order, OrderStage } from "@prisma/client";

export const stages: Array<{ key: OrderStage | "ALL"; label: string; short: string }> = [
  { key: "ALL", label: "All Orders", short: "All" },
  { key: "ORDERED", label: "Ordered", short: "Ordered" },
  { key: "TRACKING_READY", label: "Tracking Ready", short: "Ready" },
  { key: "TRACKING_SUBMITTED", label: "Tracking Submitted", short: "Submitted" },
  { key: "DELIVERED", label: "Delivered", short: "Delivered" },
  { key: "SCANNED", label: "Scanned", short: "Scanned" },
  { key: "PAID_OUT", label: "Paid Out", short: "Paid" },
  { key: "CREDIT_PAID", label: "Credit Paid", short: "Credit" },
  { key: "PROFIT_RECEIVED", label: "Profit Received", short: "Done" }
];

export const stageLabels: Record<OrderStage, string> = {
  ORDERED: "Ordered",
  TRACKING_READY: "Tracking Ready",
  TRACKING_SUBMITTED: "Tracking Submitted",
  DELIVERED: "Delivered",
  SCANNED: "Scanned",
  PAID_OUT: "Paid Out",
  CREDIT_PAID: "Credit Paid",
  PROFIT_RECEIVED: "Profit Received"
};

export type OrderWithRelations = Order & {
  amazonAccount: { id: string; name: string; defaultCreditCardDueDays: number | null } | null;
  buyGroup: { id: string; name: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  submittedBy?: { id: string; name: string | null; firstName: string | null; lastName: string | null; email: string } | null;
};

export type Financials = {
  totalPaid: number;
  totalPayout: number;
  chaseCashback: number;
  youngAdultCashback: number;
  totalCashback: number;
  amountOwed: number;
  profit: number;
};

export function calculateFinancials(order: Pick<Order, "retailPrice" | "quantity" | "payoutPerUnit" | "chaseCashbackPercent" | "youngAdultEligible">): Financials {
  const totalPaid = order.retailPrice * order.quantity;
  const totalPayout = order.payoutPerUnit * order.quantity;
  const chaseCashback = totalPaid * (order.chaseCashbackPercent / 100);
  const youngAdultCashback = order.youngAdultEligible ? totalPaid * 0.05 : 0;
  const totalCashback = chaseCashback + youngAdultCashback;
  const amountOwed = totalPaid - chaseCashback;
  const profit = totalPayout - amountOwed + youngAdultCashback;

  return { totalPaid, totalPayout, chaseCashback, youngAdultCashback, totalCashback, amountOwed, profit };
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
  type: "submit_tracking" | "check_payout" | "pay_credit_card" | "confirm_profit" | "missing_info";
  label: string;
  dueDate: Date;
  order: OrderWithRelations;
  severity: "overdue" | "today" | "upcoming";
  action: string;
  notes?: string;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export function buildReminders(orders: OrderWithRelations[], now = new Date()): Reminder[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = addDays(startOfToday, 1);

  const severityFor = (dueDate: Date): Reminder["severity"] => {
    if (dueDate < startOfToday) return "overdue";
    if (dueDate < endOfToday) return "today";
    return "upcoming";
  };

  const reminders: Reminder[] = [];

  for (const order of orders) {
    const missing = [
      !order.orderNumber && "order number",
      !order.amazonAccount && "Amazon account",
      !order.buyGroup && !order.warehouse && "buy group"
    ].filter(Boolean);

    if (missing.length > 0) {
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

    if (!(order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted)) {
      const dueDate = order.trackingNumber ? order.trackingAddedAt ?? now : addDays(order.createdAt, 1);
      reminders.push({
        id: `${order.id}:tracking`,
        type: "submit_tracking",
        label: order.trackingNumber ? "Submit tracking to warehouse" : "Tracking missing",
        dueDate,
        order,
        severity: severityFor(dueDate),
        action: order.trackingNumber ? "Submit to warehouse" : "Add tracking"
      });
    }

    if ((order.memberMarkedDelivered || order.delivered) && (order.adminMarkedScannedByWarehouse || order.scanned) && !(order.adminReceivedPayoutFromWarehouse || order.paidOut)) {
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

    if ((order.adminReceivedPayoutFromWarehouse || order.paidOut) && !(order.adminPaidMember || order.memberPaid)) {
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

    if (order.creditCardPaid && !order.profitReceived) {
      const dueDate = addDays(order.creditCardPaidAt ?? order.updatedAt, 1);
      reminders.push({
        id: `${order.id}:profit`,
        type: "confirm_profit",
        label: "Confirm profit",
        dueDate,
        order,
        severity: severityFor(dueDate),
        action: "Mark profit received"
      });
    }
  }

  return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
