"use client";

import { useActionState, useMemo, useState } from "react";
import type { AmazonAccount, BuyGroup, OrderStage, Warehouse, WorkspaceRole, WorkspaceType } from "@prisma/client";
import { Bell, ChevronRight, Copy, CreditCard, Download, Home, Inbox, Landmark, LayoutDashboard, LogOut, Package, Plus, Search, Settings, Upload } from "lucide-react";
import { addTracking, createAmazonAccount, createBuyGroup, createOperatorWorkspaceFromApp, createOrder, createPersonalWorkspaceFromApp, deleteOrder, joinOperatorWorkspaceFromApp, quickAction, setAccountDefaultDueDays, setOrderBuyGroup, updateOrder, updateProfile, updateWorkspaceMemberStatus, type AddTrackingState } from "@/app/actions";
import { signOut } from "@/app/login/actions";
import { calculateFinancials, dateTime, money, type OrderWithRelations, type Reminder, shortDate, stageLabels } from "@/lib/domain";

type Props = {
  orders: OrderWithRelations[];
  accounts: AmazonAccount[];
  buyGroups: BuyGroup[];
  warehouses: Warehouse[];
  reminders: Reminder[];
  totals: {
    openOrders: number;
    overdueReminders: number;
    totalSpent: number;
    totalPayout: number;
    totalCashback: number;
    amountOwed: number;
    realizedProfit: number;
    unrealizedProfit: number;
  };
  userEmail: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    name: string;
    email: string;
  };
  profileId: string;
  isAdmin: boolean;
  activeWorkspace: WorkspaceSwitcherItem;
  workspaces: WorkspaceSwitcherItem[];
  workspaceMembers: WorkspaceMemberItem[];
};

type WorkspaceSwitcherItem = {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
  inviteCode: string;
};

type WorkspaceMemberItem = {
  id: string;
  profileId: string;
  role: WorkspaceRole;
  status: string;
  joinedAt: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
};

type StageFilter = OrderStage | "ALL" | "ADMIN_PAID_TO_MEMBER" | "ADMIN_DONE" | "MEMBER_TRACKING_SENT" | "MEMBER_PAID" | "MEMBER_DONE";
type WorkflowViewMode = "personal" | "member" | "admin";
type WorkflowDateStep = {
  label: string;
  completed: boolean;
  date: Date | string | null | undefined;
};

const adminStages: Array<{ key: StageFilter; label: string; short: string }> = [
  { key: "ALL", label: "All", short: "All" },
  { key: "ORDERED", label: "Waiting for Member Tracking", short: "Waiting for Member Tracking" },
  { key: "TRACKING_READY", label: "Tracking Received from Member", short: "Tracking Received from Member" },
  { key: "TRACKING_SUBMITTED", label: "Submitted to Warehouse", short: "Submitted to Warehouse" },
  { key: "DELIVERED", label: "Delivered by Member", short: "Delivered by Member" },
  { key: "SCANNED", label: "Scanned by Warehouse", short: "Scanned by Warehouse" },
  { key: "PAID_OUT", label: "Paid Out from Warehouse", short: "Paid Out from Warehouse" },
  { key: "ADMIN_PAID_TO_MEMBER", label: "Paid to Member", short: "Paid to Member" },
  { key: "ADMIN_DONE", label: "Done", short: "Done" }
];

const memberStages: Array<{ key: StageFilter; label: string; short: string }> = [
  { key: "ALL", label: "All", short: "All" },
  { key: "ORDERED", label: "Ordered / Tracking Needed", short: "Ordered / Tracking Needed" },
  { key: "MEMBER_TRACKING_SENT", label: "Tracking Sent to Admin", short: "Tracking Sent to Admin" },
  { key: "DELIVERED", label: "Delivered", short: "Delivered" },
  { key: "SCANNED", label: "Scanned", short: "Scanned" },
  { key: "MEMBER_PAID", label: "Paid", short: "Paid" },
  { key: "MEMBER_DONE", label: "Done", short: "Done" }
];

const nav = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: Package },
  { key: "accounts", label: "Accounts", icon: CreditCard },
  { key: "buyGroups", label: "Buy Groups", icon: Landmark },
  { key: "analytics", label: "Analytics", icon: Bell },
  { key: "importExport", label: "Import / Export", icon: Upload },
  { key: "settings", label: "Settings", icon: Settings }
] as const;

const personalNav = nav.filter((item) => item.key !== "importExport");
const operatorAdminNav = [
  { key: "dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: Package },
  { key: "queues", label: "Queues", icon: Inbox },
  { key: "members", label: "Members", icon: Home },
  { key: "memberPayouts", label: "Member Payouts", icon: CreditCard },
  { key: "buyGroups", label: "Buy Groups", icon: Landmark },
  { key: "warehouses", label: "Warehouses", icon: Inbox },
  { key: "analytics", label: "Analytics", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings }
] as const;
const operatorMemberNav = [
  { key: "dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "My Orders", icon: Package },
  { key: "trackingNeeded", label: "Ordered / Tracking Needed", icon: Upload },
  { key: "myPayouts", label: "My Payouts", icon: CreditCard },
  { key: "settings", label: "Settings", icon: Settings }
] as const;

const actionLabels: Record<string, string> = {
  submitTracking: "Submit To Warehouse",
  submitToWarehouse: "Submit To Warehouse",
  memberDelivered: "Mark Delivered",
  scanned: "Mark Scanned by Warehouse",
  warehouseScanned: "Mark Scanned by Warehouse",
  paidOut: "Mark Paid Out from Warehouse",
  warehousePaid: "Mark Paid Out from Warehouse",
  cardPaid: "Mark Card Paid",
  profitReceived: "Mark Done",
  memberPaid: "Mark Paid to Member"
};

function cls(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatAmazonOrderNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 17);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

const stageTone: Record<OrderStage, string> = {
  ORDERED: "border-slate-500/50 bg-slate-400/10 text-slate-100 shadow-[0_0_18px_rgba(148,163,184,.08)]",
  TRACKING_READY: "border-blue-400/45 bg-blue-500/10 text-blue-100 shadow-[0_0_18px_rgba(77,163,255,.10)]",
  TRACKING_SUBMITTED: "border-blue-300/55 bg-blue-400/10 text-blue-50 shadow-[0_0_18px_rgba(96,165,250,.12)]",
  DELIVERED: "border-blue-200/45 bg-white/8 text-white shadow-[0_0_18px_rgba(191,219,254,.10)]",
  SCANNED: "border-green-400/45 bg-green-500/10 text-green-100 shadow-[0_0_18px_rgba(61,220,132,.10)]",
  PAID_OUT: "border-green-300/50 bg-green-400/10 text-green-50 shadow-[0_0_18px_rgba(74,222,128,.12)]",
  CREDIT_PAID: "border-green-300/60 bg-green-400/14 text-green-50 shadow-[0_0_18px_rgba(74,222,128,.14)]",
  PROFIT_RECEIVED: "border-white/45 bg-white/10 text-white shadow-[0_0_18px_rgba(255,255,255,.08)]"
};

function metricTone(label: string) {
  if (label.includes("Realized")) return "border-green-400/40 bg-green-500/10";
  if (label.includes("Unrealized")) return "border-blue-300/35 bg-blue-500/10";
  if (label.includes("Overdue")) return "border-white/25 bg-white/8";
  if (label.includes("Owed") || label.includes("Card")) return "border-slate-400/35 bg-slate-500/10";
  if (label.includes("Cashback")) return "border-cyan/30 bg-cyan/10";
  return "border-line bg-panel/80";
}

function reminderTone(severity: Reminder["severity"]) {
  if (severity === "overdue") return "border-white/30 bg-white/10";
  if (severity === "today") return "border-blue-300/40 bg-blue-500/10";
  return "border-slate-500/40 bg-slate-500/10";
}

function memberName(order: OrderWithRelations) {
  if (!order.submittedBy) return "Unknown member";
  const fullName = [order.submittedBy.firstName, order.submittedBy.lastName].filter(Boolean).join(" ").trim();
  return fullName || order.submittedBy.name || order.submittedBy.email;
}

function memberWorkflowLabel(order: OrderWithRelations) {
  if (order.adminPaidMember || order.memberPaid || order.profitReceived) return "Paid";
  if (order.adminReceivedPayoutFromWarehouse || order.paidOut) return "Waiting For Payout";
  if (order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned) return "Scanned";
  if (order.memberMarkedDelivered || order.delivered) return "Delivered";
  if (order.memberSubmittedTrackingToAdmin || order.trackingNumber) return "Tracking Sent to Admin";
  return "Ordered / Tracking Needed";
}

function adminWorkflowLabel(order: OrderWithRelations) {
  if (order.adminPaidMember || order.memberPaid) return "Done";
  if (order.adminReceivedPayoutFromWarehouse || order.paidOut) return "Paid Out from Warehouse";
  if (order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned) return "Scanned by Warehouse";
  if (order.memberMarkedDelivered || order.delivered) return "Delivered by Member";
  if (order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted) return "Submitted to Warehouse";
  if (order.memberSubmittedTrackingToAdmin || order.trackingNumber) return "Tracking Received from Member";
  return "Waiting for Member Tracking";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function firstDate(...dates: Array<Date | string | null | undefined>) {
  return dates.find(Boolean) ?? null;
}

function compactWorkflowDate(date: Date | string | null | undefined) {
  if (!date) return "Pending";
  return dateTime(date);
}

function buildPersonalWorkflowSteps(order: OrderWithRelations): WorkflowDateStep[] {
  return [
    { label: "Ordered", completed: true, date: order.createdAt },
    {
      label: "Tracking submitted",
      completed: order.adminSubmittedTrackingToWarehouse || order.adminSubmittedTrackingToBuyGroup || order.trackingSubmitted,
      date: firstDate(order.adminSubmittedTrackingToWarehouseAt, order.adminSubmittedTrackingToBuyGroupAt, order.trackingSubmittedAt)
    },
    {
      label: "Delivered",
      completed: order.memberMarkedDelivered || order.delivered,
      date: firstDate(order.memberMarkedDeliveredAt, order.deliveredAt)
    },
    {
      label: "Scanned",
      completed: order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned,
      date: firstDate(order.adminMarkedScannedByWarehouseAt, order.warehouseScannedAt, order.scannedAt)
    },
    {
      label: "Warehouse payout",
      completed: order.adminReceivedPayoutFromWarehouse || order.buyGroupPaidAdmin || order.paidOut,
      date: firstDate(order.adminReceivedPayoutFromWarehouseAt, order.buyGroupPaidAdminAt, order.paidOutAt)
    },
    { label: "Credit paid", completed: order.creditCardPaid, date: order.creditCardPaidAt },
    {
      label: "Done",
      completed: order.profitReceived || order.adminPaidMember || order.memberPaid,
      date: firstDate(order.profitReceivedAt, order.adminPaidMemberAt, order.memberPaidAt)
    }
  ];
}

function buildMemberWorkflowSteps(order: OrderWithRelations): WorkflowDateStep[] {
  return [
    { label: "Ordered / Tracking Needed", completed: true, date: order.createdAt },
    {
      label: "Tracking Sent to Admin",
      completed: order.memberSubmittedTrackingToAdmin || !!order.trackingNumber,
      date: firstDate(order.memberSubmittedTrackingToAdminAt, order.trackingAddedAt)
    },
    {
      label: "Delivered",
      completed: order.memberMarkedDelivered || order.delivered,
      date: firstDate(order.memberMarkedDeliveredAt, order.deliveredAt)
    },
    {
      label: "Scanned",
      completed: order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned,
      date: firstDate(order.adminMarkedScannedByWarehouseAt, order.warehouseScannedAt, order.scannedAt)
    },
    {
      label: "Paid",
      completed: order.adminPaidMember || order.memberPaid || order.profitReceived,
      date: firstDate(order.adminPaidMemberAt, order.memberPaidAt, order.profitReceivedAt)
    },
    {
      label: "Done",
      completed: order.adminPaidMember || order.memberPaid || order.profitReceived,
      date: firstDate(order.adminPaidMemberAt, order.memberPaidAt, order.profitReceivedAt)
    }
  ];
}

function buildAdminWorkflowSteps(order: OrderWithRelations): WorkflowDateStep[] {
  return [
    { label: "Waiting for Member Tracking", completed: true, date: order.createdAt },
    {
      label: "Tracking Received from Member",
      completed: order.memberSubmittedTrackingToAdmin || !!order.trackingNumber,
      date: firstDate(order.memberSubmittedTrackingToAdminAt, order.trackingAddedAt)
    },
    {
      label: "Submitted to Warehouse",
      completed: order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted,
      date: firstDate(order.adminSubmittedTrackingToWarehouseAt, order.trackingSubmittedAt)
    },
    {
      label: "Delivered by Member",
      completed: order.memberMarkedDelivered || order.delivered,
      date: firstDate(order.memberMarkedDeliveredAt, order.deliveredAt)
    },
    {
      label: "Scanned by Warehouse",
      completed: order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned,
      date: firstDate(order.adminMarkedScannedByWarehouseAt, order.warehouseScannedAt, order.scannedAt)
    },
    {
      label: "Paid Out from Warehouse",
      completed: order.adminReceivedPayoutFromWarehouse || order.paidOut,
      date: firstDate(order.adminReceivedPayoutFromWarehouseAt, order.paidOutAt)
    },
    {
      label: "Paid to Member",
      completed: order.adminPaidMember || order.memberPaid,
      date: firstDate(order.adminPaidMemberAt, order.memberPaidAt)
    },
    {
      label: "Done",
      completed: order.adminPaidMember || order.memberPaid || order.profitReceived,
      date: firstDate(order.adminPaidMemberAt, order.memberPaidAt, order.profitReceivedAt)
    }
  ];
}

function buildWorkflowSteps(order: OrderWithRelations, viewMode: WorkflowViewMode) {
  if (viewMode === "admin") return buildAdminWorkflowSteps(order);
  if (viewMode === "personal") return buildPersonalWorkflowSteps(order);
  return buildMemberWorkflowSteps(order);
}

function matchesMemberStage(order: OrderWithRelations, selectedStage: StageFilter) {
  if (selectedStage === "ALL") return true;
  if (selectedStage === "ORDERED") return !(order.memberSubmittedTrackingToAdmin || order.trackingNumber);
  if (selectedStage === "MEMBER_TRACKING_SENT") return !!order.trackingNumber && !(order.memberMarkedDelivered || order.delivered) && !(order.adminPaidMember || order.memberPaid || order.profitReceived);
  if (selectedStage === "DELIVERED") return (order.memberMarkedDelivered || order.delivered) && !(order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned) && !(order.adminPaidMember || order.memberPaid || order.profitReceived);
  if (selectedStage === "SCANNED") return (order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned) && !(order.adminPaidMember || order.memberPaid || order.profitReceived);
  if (selectedStage === "MEMBER_PAID") return order.adminPaidMember || order.memberPaid || order.profitReceived;
  if (selectedStage === "MEMBER_DONE") return order.adminPaidMember || order.memberPaid || order.profitReceived;
  return order.currentStage === selectedStage;
}

function matchesAdminStage(order: OrderWithRelations, selectedStage: StageFilter) {
  if (selectedStage === "ALL") return true;
  if (selectedStage === "ORDERED") return !order.trackingNumber;
  if (selectedStage === "TRACKING_READY") return !!order.trackingNumber && !(order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted);
  if (selectedStage === "TRACKING_SUBMITTED") return (order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted) && !(order.memberMarkedDelivered || order.delivered);
  if (selectedStage === "DELIVERED") return (order.memberMarkedDelivered || order.delivered) && !(order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned);
  if (selectedStage === "SCANNED") return (order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned) && !(order.adminReceivedPayoutFromWarehouse || order.paidOut);
  if (selectedStage === "PAID_OUT") return (order.adminReceivedPayoutFromWarehouse || order.paidOut) && !(order.adminPaidMember || order.memberPaid);
  if (selectedStage === "ADMIN_PAID_TO_MEMBER") return order.adminPaidMember || order.memberPaid;
  if (selectedStage === "ADMIN_DONE") return order.adminPaidMember || order.memberPaid || order.profitReceived;
  return order.currentStage === selectedStage;
}

function stageToneKey(stage: StageFilter): OrderStage {
  if (stage === "MEMBER_TRACKING_SENT") return "TRACKING_READY";
  if (stage === "MEMBER_PAID" || stage === "MEMBER_DONE" || stage === "ADMIN_PAID_TO_MEMBER" || stage === "ADMIN_DONE") return "PROFIT_RECEIVED";
  if (stage === "ALL") return "ORDERED";
  return stage;
}

export default function CommandCenter({ orders, accounts, buyGroups, warehouses, reminders, totals, userEmail, profile, activeWorkspace, workspaces, profileId, isAdmin, workspaceMembers }: Props) {
  const workspaceNav = activeWorkspace.type === "OPERATOR" ? (isAdmin ? operatorAdminNav : operatorMemberNav) : personalNav;
  const isOperatorAdmin = activeWorkspace.type === "OPERATOR" && isAdmin;
  const [section, setSection] = useState<string>("dashboard");
  const [stage, setStage] = useState<StageFilter>("ORDERED");
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [buyGroupFilter, setBuyGroupFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [memberFilter, setMemberFilter] = useState("ALL");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null);

  const filteredOrders = useMemo(() => {
    const q = query.toLowerCase();
    return orders.filter((order) => {
      const inStage = isOperatorAdmin ? matchesAdminStage(order, stage) : matchesMemberStage(order, stage);
      const inAccount = accountFilter === "ALL" || order.amazonAccountId === accountFilter;
      const inBuyGroup = buyGroupFilter === "ALL" || order.buyGroupId === buyGroupFilter;
      const inWarehouse = warehouseFilter === "ALL" || order.warehouseId === warehouseFilter;
      const inMember = memberFilter === "ALL" || order.submittedByProfileId === memberFilter;
      const matches =
        order.itemName.toLowerCase().includes(q) ||
        order.orderNumber?.toLowerCase().includes(q) ||
        order.trackingNumber?.toLowerCase().includes(q) ||
        order.amazonAccount?.name.toLowerCase().includes(q) ||
        order.buyGroup?.name.toLowerCase().includes(q) ||
        order.warehouse?.name.toLowerCase().includes(q) ||
        order.submittedBy?.email.toLowerCase().includes(q) ||
        memberName(order).toLowerCase().includes(q);
      return inStage && inAccount && inBuyGroup && inWarehouse && inMember && (!q || matches);
    });
  }, [accountFilter, buyGroupFilter, memberFilter, orders, query, stage, warehouseFilter]);

  const counts = useMemo(() => {
    const result = new Map<StageFilter, number>();
    result.set("ALL", orders.length);
    if (isOperatorAdmin) {
      adminStages.slice(1).forEach((item) => result.set(item.key, orders.filter((order) => matchesAdminStage(order, item.key)).length));
    } else {
      memberStages.slice(1).forEach((item) => result.set(item.key, orders.filter((order) => matchesMemberStage(order, item.key)).length));
    }
    return result;
  }, [isOperatorAdmin, orders]);

  return (
    <main className="min-h-screen text-slate-100">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-cyan/20 bg-surface/80 px-4 py-5 shadow-neon backdrop-blur-xl lg:block">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan shadow-neon">
            <Home size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Buy Group Ops</div>
            <div className="max-w-40 truncate text-xs text-cyan/80">{userEmail}</div>
          </div>
        </div>
        <nav className="space-y-1">
          <select
            value={activeWorkspace.id}
            onChange={(event) => {
              window.location.href = `/?workspace=${event.target.value}`;
            }}
            className="mb-4 w-full px-3 py-2 text-sm"
            aria-label="Workspace"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.type === "PERSONAL" ? "Personal" : workspace.name} · {workspace.role}
              </option>
            ))}
          </select>
          {workspaceNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={cls(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                  section === item.key ? "border border-cyan/30 bg-cyan/10 text-cyan shadow-neon" : "text-muted hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-h-screen bg-surface/35 lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-cyan/20 bg-surface/80 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,.22)] backdrop-blur-xl md:px-7">
          <div>
            <div className="text-xs uppercase tracking-[.18em] text-cyan/80">{activeWorkspace.type === "PERSONAL" ? "Personal Mode" : `${activeWorkspace.role} Mode`}</div>
            <h1 className="text-xl font-semibold text-white">What needs action?</h1>
          </div>
          <div className="flex items-center gap-2">
            <form action={signOut}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-white" title="Log out">
                <LogOut size={16} />
                Logout
              </button>
            </form>
            <button onClick={() => setNewOrderOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/20 px-3 py-2 text-sm font-medium text-cyan shadow-neon hover:bg-cyan/30">
              <Plus size={17} />
              New Order
            </button>
          </div>
        </header>

        <div className="px-4 py-5 md:px-7">
          {section === "dashboard" && <Dashboard orders={orders} buyGroups={buyGroups} reminders={reminders} totals={totals} setSection={setSection} setStage={setStage} setSelectedOrder={setSelectedOrder} activeWorkspace={activeWorkspace} isAdmin={isOperatorAdmin} />}
          {section === "orders" && (
            <OrdersView
              orders={filteredOrders}
              accounts={accounts}
              buyGroups={buyGroups}
              warehouses={warehouses}
              workspaceMembers={workspaceMembers}
              isAdmin={isOperatorAdmin}
              viewMode={isOperatorAdmin ? "admin" : activeWorkspace.type === "PERSONAL" ? "personal" : "member"}
              counts={counts}
              stage={stage}
              setStage={setStage}
              query={query}
              setQuery={setQuery}
              accountFilter={accountFilter}
              setAccountFilter={setAccountFilter}
              buyGroupFilter={buyGroupFilter}
              setBuyGroupFilter={setBuyGroupFilter}
              warehouseFilter={warehouseFilter}
              setWarehouseFilter={setWarehouseFilter}
              memberFilter={memberFilter}
              setMemberFilter={setMemberFilter}
              setSelectedOrder={setSelectedOrder}
            />
          )}
          {section === "accounts" && <AccountsView accounts={accounts} orders={orders} setSelectedOrder={setSelectedOrder} workspaceId={activeWorkspace.id} />}
          {section === "buyGroups" && <BuyGroupsView buyGroups={buyGroups} orders={orders} workspaceId={activeWorkspace.id} />}
          {section === "warehouses" && <WarehousesView warehouses={warehouses} orders={orders} />}
          {section === "queues" && (
            <div className="space-y-4">
              <FilterBar
                query={query}
                setQuery={setQuery}
                accountFilter={accountFilter}
                setAccountFilter={setAccountFilter}
                buyGroupFilter={buyGroupFilter}
                setBuyGroupFilter={setBuyGroupFilter}
                warehouseFilter={warehouseFilter}
                setWarehouseFilter={setWarehouseFilter}
                memberFilter={memberFilter}
                setMemberFilter={setMemberFilter}
                accounts={accounts}
                buyGroups={buyGroups}
                warehouses={warehouses}
                workspaceMembers={workspaceMembers}
                showMemberFilter={isOperatorAdmin}
              />
              <OperatorQueues orders={filteredOrders} setStage={setStage} setSection={setSection} />
            </div>
          )}
          {section === "members" && <MembersView activeWorkspace={activeWorkspace} orders={orders} workspaceMembers={workspaceMembers} profileId={profileId} />}
          {section === "memberPayouts" && <MemberPayoutsView orders={orders} activeWorkspace={activeWorkspace} />}
          {section === "trackingNeeded" && <TrackingNeededView orders={orders} />}
          {section === "myPayouts" && <MyPayoutsView orders={orders} />}
          {section === "analytics" && <AnalyticsView orders={orders} />}
          {section === "importExport" && <ImportExportView orders={orders} />}
          {section === "settings" && <SettingsView profile={profile} activeWorkspace={activeWorkspace} workspaces={workspaces} />}
        </div>
      </section>

      {newOrderOpen && <NewOrderModal accounts={accounts} buyGroups={buyGroups} workspaceId={activeWorkspace.id} onClose={() => setNewOrderOpen(false)} />}
      {selectedOrder && <OrderPanel order={selectedOrder} accounts={accounts} buyGroups={buyGroups} workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} memberStatus={workspaceMembers.find((member) => member.profileId === selectedOrder.submittedByProfileId)?.status ?? null} isAdmin={isOperatorAdmin} onClose={() => setSelectedOrder(null)} />}
    </main>
  );
}

function Dashboard({ orders, buyGroups, reminders, totals, setSection, setStage, setSelectedOrder, activeWorkspace, isAdmin }: {
  orders: OrderWithRelations[];
  buyGroups: BuyGroup[];
  reminders: Reminder[];
  totals: Props["totals"];
  setSection: (value: string) => void;
  setStage: (value: StageFilter) => void;
  setSelectedOrder: (order: OrderWithRelations) => void;
  activeWorkspace: WorkspaceSwitcherItem;
  isAdmin: boolean;
}) {
  const adminMetrics = [
    { label: "Open Orders", value: totals.openOrders.toString(), featured: true },
    { label: "Amount Owed", value: money(totals.amountOwed), featured: true },
    { label: "Realized Profit", value: money(totals.realizedProfit), featured: true },
    { label: "Unrealized Profit", value: money(totals.unrealizedProfit), featured: true },
    { label: "Overdue Reminders", value: totals.overdueReminders.toString(), featured: true },
    { label: "Payout Expected", value: money(totals.totalPayout), featured: false },
    { label: "Total Spent", value: money(totals.totalSpent), featured: false },
    { label: "Total Cashback", value: money(totals.totalCashback), featured: false },
    { label: "Tracking Received from Member", value: orders.filter((order) => order.trackingNumber && !(order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted)).length.toString(), featured: false },
    { label: "Waiting Scan", value: orders.filter((order) => (order.memberMarkedDelivered || order.delivered) && !(order.adminMarkedScannedByWarehouse || order.scanned)).length.toString(), featured: false },
    { label: "Members To Pay", value: orders.filter((order) => (order.adminReceivedPayoutFromWarehouse || order.paidOut) && !(order.adminPaidMember || order.memberPaid)).length.toString(), featured: false }
  ];
  const memberMetrics = [
    { label: "My Open Orders", value: totals.openOrders.toString(), featured: true },
    { label: "Amount Owed To Me", value: money(totals.amountOwed), featured: true },
    { label: "Ordered / Tracking Needed", value: orders.filter((order) => !order.trackingNumber).length.toString(), featured: false },
    { label: "Tracking Sent to Admin", value: orders.filter((order) => order.memberSubmittedTrackingToAdmin || order.trackingNumber).length.toString(), featured: false },
    { label: "Delivered", value: orders.filter((order) => order.memberMarkedDelivered || order.delivered).length.toString(), featured: false },
    { label: "Paid", value: orders.filter((order) => order.adminPaidMember || order.memberPaid || order.profitReceived).length.toString(), featured: false }
  ];
  const metrics = isAdmin ? adminMetrics : memberMetrics;
  const dashboardQueues = isAdmin ? adminStages.slice(1) : memberStages.slice(1);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <section>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6 2xl:grid-cols-8">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={cls(
                "rounded-lg border shadow-glow",
                metricTone(metric.label),
                metric.featured ? "min-h-32 p-5 sm:col-span-2 xl:col-span-2" : "min-h-24 p-3 xl:col-span-2 2xl:col-span-1"
              )}
            >
              <div className={cls("text-xs font-medium uppercase tracking-[.12em]", metric.featured ? "text-slate-300" : "text-muted")}>{metric.label}</div>
              <div className={cls("mt-3 max-w-full break-words font-semibold leading-none text-white [overflow-wrap:anywhere]", metric.featured ? "text-[clamp(1.85rem,3vw,2.5rem)]" : "text-[clamp(1.25rem,1.8vw,1.75rem)]")}>{metric.value}</div>
              {metric.featured && <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-blue-400 to-green-400" />}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-cyan/20 bg-panel/80 p-4 shadow-glow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{activeWorkspace.type === "OPERATOR" && isAdmin ? "Operator Workflow Queues" : "Active Workflow Queues"}</h2>
            <button onClick={() => setSection("orders")} className="text-sm text-blue-300">Open orders</button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {dashboardQueues.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setStage(item.key);
                  setSection("orders");
                }}
                className={cls("flex items-center justify-between rounded-lg border px-4 py-3 text-left hover:shadow-neon", stageTone[stageToneKey(item.key)])}
              >
                <span>{item.label}</span>
                <span className="rounded-md bg-black/25 px-2 py-1 text-xs text-white">{orders.filter((order) => isAdmin ? matchesAdminStage(order, item.key) : matchesMemberStage(order, item.key)).length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <InboxPanel reminders={reminders} buyGroups={buyGroups} setSelectedOrder={setSelectedOrder} />
    </div>
  );
}

function InboxPanel({ reminders, buyGroups, setSelectedOrder }: { reminders: Reminder[]; buyGroups: BuyGroup[]; setSelectedOrder: (order: OrderWithRelations) => void }) {
  return (
    <section className="rounded-lg border border-slate-500/30 bg-panel/80 p-4 shadow-glow">
      <div className="mb-4 flex items-center gap-2">
        <Inbox size={18} className="text-blue-300" />
        <h2 className="font-semibold">Inbox / Needs Attention</h2>
      </div>
      {(["overdue", "today", "upcoming"] as const).map((group) => (
        <div key={group} className="mb-5 last:mb-0">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[.15em] text-muted">{group === "today" ? "Due Today" : group}</div>
          <div className="space-y-2">
            {reminders.filter((item) => item.severity === group).slice(0, 8).map((item) => (
              <div key={item.id} className={cls("rounded-lg border p-3", reminderTone(item.severity))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="mt-1 text-xs text-muted">{item.order.itemName} · due {shortDate(item.dueDate)}</div>
                    {item.notes && <div className="mt-1 text-xs text-blue-200">{item.notes}</div>}
                  </div>
                  <button onClick={() => setSelectedOrder(item.order)} className="rounded-md border border-line p-1.5 text-muted hover:text-white" title="Open order">
                    <ChevronRight size={15} />
                  </button>
                </div>
                <ReminderAction reminder={item} buyGroups={buyGroups} />
              </div>
            ))}
            {reminders.filter((item) => item.severity === group).length === 0 && <div className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-muted">Clear</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

function ReminderAction({ reminder, buyGroups }: { reminder: Reminder; buyGroups: BuyGroup[] }) {
  if (reminder.type === "missing_info" && reminder.notes?.includes("buy group")) {
    return (
      <form action={setOrderBuyGroup} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="id" value={reminder.order.id} />
        <input type="hidden" name="workspaceId" value={reminder.order.workspaceId ?? ""} />
        <select name="buyGroupId" required defaultValue="" className="min-w-0 flex-1 px-2.5 py-1.5 text-xs">
          <option value="">Set buy group</option>
          {buyGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <button className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium hover:bg-white/20">Save</button>
      </form>
    );
  }

  if (reminder.type === "submit_tracking" && !reminder.order.trackingNumber) return null;
  const action =
    reminder.type === "submit_tracking" ? "submitTracking" :
    reminder.type === "check_payout" ? "paidOut" :
    reminder.type === "pay_credit_card" ? "cardPaid" :
    reminder.type === "confirm_profit" ? "profitReceived" : "";

  if (!action) return null;
  return (
    <form action={quickAction} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="id" value={reminder.order.id} />
      <input type="hidden" name="workspaceId" value={reminder.order.workspaceId ?? ""} />
      <input type="hidden" name="action" value={action} />
      <button className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium hover:bg-white/20">{reminder.action}</button>
    </form>
  );
}

function FilterBar({
  query,
  setQuery,
  accountFilter,
  setAccountFilter,
  buyGroupFilter,
  setBuyGroupFilter,
  warehouseFilter,
  setWarehouseFilter,
  memberFilter,
  setMemberFilter,
  accounts,
  buyGroups,
  warehouses,
  workspaceMembers,
  showMemberFilter
}: {
  query: string;
  setQuery: (value: string) => void;
  accountFilter: string;
  setAccountFilter: (value: string) => void;
  buyGroupFilter: string;
  setBuyGroupFilter: (value: string) => void;
  warehouseFilter: string;
  setWarehouseFilter: (value: string) => void;
  memberFilter: string;
  setMemberFilter: (value: string) => void;
  accounts: AmazonAccount[];
  buyGroups: BuyGroup[];
  warehouses: Warehouse[];
  workspaceMembers: WorkspaceMemberItem[];
  showMemberFilter: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <label className="flex min-w-0 items-center gap-2 rounded-lg border border-cyan/20 bg-panel/80 px-3 py-2 text-muted shadow-glow">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders or members" className="w-full min-w-0 border-0 bg-transparent p-0 text-sm focus:shadow-none" />
      </label>
      {showMemberFilter && (
        <select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} className="min-w-0 px-3 py-2 text-sm">
          <option value="ALL">All members</option>
          {workspaceMembers.map((member) => <option key={member.profileId} value={member.profileId}>{member.name ?? member.email}</option>)}
        </select>
      )}
      <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="min-w-0 px-3 py-2 text-sm">
        <option value="ALL">All Amazon accounts</option>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
      <select value={buyGroupFilter} onChange={(event) => setBuyGroupFilter(event.target.value)} className="min-w-0 px-3 py-2 text-sm">
        <option value="ALL">All buy groups</option>
        {buyGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
      <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} className="min-w-0 px-3 py-2 text-sm">
        <option value="ALL">All warehouses</option>
        {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
      </select>
    </div>
  );
}

function OrdersView({ orders, accounts, buyGroups, warehouses, workspaceMembers, isAdmin, viewMode, counts, stage, setStage, query, setQuery, accountFilter, setAccountFilter, buyGroupFilter, setBuyGroupFilter, warehouseFilter, setWarehouseFilter, memberFilter, setMemberFilter, setSelectedOrder }: {
  orders: OrderWithRelations[];
  accounts: AmazonAccount[];
  buyGroups: BuyGroup[];
  warehouses: Warehouse[];
  workspaceMembers: WorkspaceMemberItem[];
  isAdmin: boolean;
  viewMode: WorkflowViewMode;
  counts: Map<StageFilter, number>;
  stage: StageFilter;
  setStage: (value: StageFilter) => void;
  query: string;
  setQuery: (value: string) => void;
  accountFilter: string;
  setAccountFilter: (value: string) => void;
  buyGroupFilter: string;
  setBuyGroupFilter: (value: string) => void;
  warehouseFilter: string;
  setWarehouseFilter: (value: string) => void;
  memberFilter: string;
  setMemberFilter: (value: string) => void;
  setSelectedOrder: (order: OrderWithRelations) => void;
}) {
  const workflowTabs = isAdmin ? adminStages : memberStages;
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {workflowTabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setStage(item.key)}
              className={cls(
                "rounded-lg border px-3 py-2 text-sm",
                stage === item.key
                  ? item.key === "ALL" ? "border-cyan/40 bg-cyan/20 text-cyan shadow-neon" : stageTone[stageToneKey(item.key)]
                  : "border-line bg-panel/80 text-muted hover:border-cyan/30 hover:text-white"
              )}
              title={item.label}
            >
              {item.short} <span className="ml-1 text-xs opacity-70">{counts.get(item.key) ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="xl:min-w-[900px]">
          <FilterBar query={query} setQuery={setQuery} accountFilter={accountFilter} setAccountFilter={setAccountFilter} buyGroupFilter={buyGroupFilter} setBuyGroupFilter={setBuyGroupFilter} warehouseFilter={warehouseFilter} setWarehouseFilter={setWarehouseFilter} memberFilter={memberFilter} setMemberFilter={setMemberFilter} accounts={accounts} buyGroups={buyGroups} warehouses={warehouses} workspaceMembers={workspaceMembers} showMemberFilter={isAdmin} />
        </div>
      </div>
      <div className="space-y-3">
        {orders.map((order) => <OrderQueueCard key={order.id} order={order} stage={stage} isAdmin={isAdmin} viewMode={viewMode} memberSafe={!isAdmin} onOpen={() => setSelectedOrder(order)} />)}
        {orders.length === 0 && <div className="rounded-lg border border-dashed border-line bg-panel/60 p-8 text-center text-muted">No orders in this queue.</div>}
      </div>
    </section>
  );
}

function OrderQueueCard({ order, stage, onOpen, isAdmin = false, viewMode = "member", memberSafe = false }: { order: OrderWithRelations; stage: StageFilter; onOpen: () => void; isAdmin?: boolean; viewMode?: WorkflowViewMode; memberSafe?: boolean }) {
  const financials = calculateFinancials(order);
  const displayStage = stage === "ALL" || !Object.prototype.hasOwnProperty.call(stageLabels, stage) ? order.currentStage : stage;
  const workflowSteps = buildWorkflowSteps(order, viewMode);
  const statusFields: Array<[string, string]> = isAdmin ? [
    ["Submitted by", memberName(order)],
    ["Member email", order.submittedBy?.email ?? "Unknown"],
    ["Tracking", order.trackingNumber ?? "Missing"],
    ["Member tracking", order.memberSubmittedTrackingToAdmin || order.trackingNumber ? "Received from member" : "Waiting for member tracking"],
    ["Warehouse submission", order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted ? "Submitted to warehouse" : "Not submitted to warehouse"],
    ["Member delivery", order.memberMarkedDelivered || order.delivered ? "Delivered by member" : "Not delivered by member"],
    ["Warehouse scan", order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned ? "Scanned by warehouse" : "Not scanned"],
    ["Warehouse payout", order.adminReceivedPayoutFromWarehouse || order.paidOut ? "Received" : "Open"],
    ["Paid to member", order.adminPaidMember || order.memberPaid ? "Paid" : "Open"]
  ] : [
    ["Status", memberWorkflowLabel(order)],
    ["Tracking", order.trackingNumber ?? "Missing"],
    ["Delivered", order.memberMarkedDelivered || order.delivered ? "Yes" : "No"],
    ["Scanned", order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned ? "Yes" : "No"],
    ["Paid", order.adminPaidMember || order.memberPaid || order.profitReceived ? "Yes" : "No"]
  ];
  const fieldsByStage: Record<OrderStage, Array<[string, string]>> = {
    ORDERED: [
      ...(memberSafe ? [] : [["Submitted by", memberName(order)], ["Member email", order.submittedBy?.email ?? "Unknown"]] as Array<[string, string]>),
      ["Qty", String(order.quantity)],
      ["Account", order.amazonAccount?.name ?? "Missing"],
      ["Group", order.buyGroup?.name ?? "Missing"],
      ["Destination", order.buyGroup?.name ?? order.warehouse?.code ?? "Missing"],
      ["Order #", order.orderNumber ?? "Missing"],
      ["Retail", money(order.retailPrice)],
      ["Payout", money(order.payoutPerUnit)],
      ["Cashback", `${order.chaseCashbackPercent}%`],
      ["Est. Profit", money(financials.profit)],
      ["Created", shortDate(order.createdAt)]
    ],
    TRACKING_READY: [
      ["Tracking", order.trackingNumber ?? "Missing"],
      ["Group", order.buyGroup?.name ?? "Missing"],
      ["Destination", order.buyGroup?.name ?? order.warehouse?.code ?? "Missing"],
      ["Account", order.amazonAccount?.name ?? "Missing"],
      ["Created", shortDate(order.createdAt)],
      ["Tracking Added", shortDate(order.trackingAddedAt)]
    ],
    TRACKING_SUBMITTED: [
      ["Tracking", order.trackingNumber ?? "Missing"],
      ["Destination", order.buyGroup?.name ?? order.warehouse?.code ?? "Missing"],
      ["Submitted to warehouse", shortDate(order.trackingSubmittedAt)],
      ["Delivered", order.delivered ? "Yes" : "No"]
    ],
    DELIVERED: [
      ["Group", order.buyGroup?.name ?? "Missing"],
      ["Delivered", shortDate(order.deliveredAt)],
      ["Total Payout", money(financials.totalPayout)],
      ["Payout Due", shortDate(order.deliveredAt ? new Date(new Date(order.deliveredAt).getTime() + 2 * 86400000) : null)],
      ["Tracking", order.trackingNumber ?? "Missing"]
    ],
    SCANNED: [
      ["Destination", order.buyGroup?.name ?? order.warehouse?.code ?? "Missing"],
      ["Scanned", shortDate(order.scannedAt)],
      ["Group", order.buyGroup?.name ?? "Missing"],
      ["Payout", order.paidOut ? "Paid" : "Open"]
    ],
    PAID_OUT: [
      ["Paid Out from Warehouse", shortDate(order.paidOutAt)],
      ["Amount Owed", money(financials.amountOwed)],
      ["Unrealized Profit", money(financials.profit)],
      ["Account", order.amazonAccount?.name ?? "Missing"],
      ["Card", order.creditCardPaid ? "Paid" : "Open"]
    ],
    CREDIT_PAID: [
      ["Card Paid", shortDate(order.creditCardPaidAt)],
      ["Realized Profit", money(financials.profit)],
      ["Done", order.profitReceived ? "Yes" : "No"]
    ],
    PROFIT_RECEIVED: [
      ["Realized Profit", money(financials.profit)],
      ["Total Paid", money(financials.totalPaid)],
      ["Total Payout", money(financials.totalPayout)],
      ["Done", shortDate(order.profitReceivedAt)],
      ["Account", order.amazonAccount?.name ?? "Missing"],
      ["Group", order.buyGroup?.name ?? "Missing"]
    ]
  };

  return (
    <article className={cls("rounded-lg border bg-panel/80 p-4 shadow-glow transition hover:-translate-y-0.5 hover:shadow-neon", stageTone[order.currentStage])}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <button onClick={onOpen} className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{order.itemName}</h3>
            <span className={cls("rounded-md border px-2 py-1 text-xs", stageTone[order.currentStage])}>{memberSafe ? memberWorkflowLabel(order) : adminWorkflowLabel(order)}</span>
          </div>
          {!memberSafe && order.submittedBy && <div className="mt-1 text-xs text-muted">Submitted by <span className="text-white">{memberName(order)}</span> · {order.submittedBy.email}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            {(isAdmin ? statusFields : statusFields.concat(fieldsByStage[displayStage as OrderStage].slice(1, 5))).map(([label, value]) => (
              <span key={label} className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-muted">
                {label}: <span className="text-white">{value}</span>
              </span>
            ))}
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {workflowSteps.map((step) => (
              <span key={step.label} className={cls("rounded-md border px-2.5 py-1.5 text-xs", step.completed ? "border-white/10 bg-white/[.06] text-slate-300" : "border-line bg-black/10 text-slate-500")}>
                <span className="block truncate">{step.label}</span>
                <span className={cls("mt-0.5 block truncate font-medium", step.completed && step.date ? "text-white" : "text-muted")}>{step.completed ? compactWorkflowDate(step.date) : "Pending"}</span>
              </span>
            ))}
          </div>
        </button>
        <StageActions order={order} onOpen={onOpen} isAdmin={isAdmin} />
      </div>
    </article>
  );
}

function StageActions({ order, onOpen, isAdmin }: { order: OrderWithRelations; onOpen: () => void; isAdmin: boolean }) {
  if (!isAdmin && !order.trackingNumber) {
    return <SubmitTrackingForm order={order} />;
  }

  const action = isAdmin
    ? (!(order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted) && order.trackingNumber ? "submitToWarehouse" :
      (order.memberMarkedDelivered || order.delivered) && !(order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned) ? "warehouseScanned" :
      (order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned) && !(order.adminReceivedPayoutFromWarehouse || order.paidOut) ? "warehousePaid" :
      (order.adminReceivedPayoutFromWarehouse || order.paidOut) && !(order.adminPaidMember || order.memberPaid) ? "memberPaid" : "")
    : (order.trackingNumber && !(order.memberMarkedDelivered || order.delivered) ? "memberDelivered" : "");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {order.trackingNumber && (
        <button type="button" onClick={() => navigator.clipboard?.writeText(order.trackingNumber ?? "")} className="rounded-lg border border-line p-2 text-muted hover:text-white" title="Copy tracking number">
          <Copy size={16} />
        </button>
      )}
      {action && (
        <form action={quickAction}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="workspaceId" value={order.workspaceId ?? ""} />
          <input type="hidden" name="action" value={action} />
          <button className="rounded-lg border border-green-400/40 bg-green-500/15 px-3 py-2 text-sm font-medium text-green-100 shadow-neon">{actionLabels[action]}</button>
        </form>
      )}
      {isAdmin && (order.memberMarkedDelivered || order.delivered) && !(order.adminReceivedPayoutFromWarehouse || order.paidOut) && (
        <form action={quickAction}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="workspaceId" value={order.workspaceId ?? ""} />
          <input type="hidden" name="action" value="snoozePayout" />
          <input type="hidden" name="days" value="3" />
          <button className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-white">Snooze</button>
        </form>
      )}
      <button onClick={onOpen} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-white">Open</button>
    </div>
  );
}

function SubmitTrackingForm({ order }: { order: OrderWithRelations }) {
  const initialState: AddTrackingState = { error: null };
  const [state, formAction] = useActionState(addTracking, initialState);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showClientError, setShowClientError] = useState(false);
  const hasTrackingNumber = trackingNumber.trim().length > 0;
  const showError = showClientError || !!state.error;
  const errorMessage = showClientError ? "Tracking number required." : state.error;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!hasTrackingNumber) {
          event.preventDefault();
          setShowClientError(true);
        }
      }}
      className="min-w-72"
    >
      <div className="flex items-start gap-2">
        <input type="hidden" name="id" value={order.id} />
        <input type="hidden" name="workspaceId" value={order.workspaceId ?? ""} />
        <div className="min-w-0 flex-1">
          <input
            name="trackingNumber"
            value={trackingNumber}
            placeholder="Ex: TBA330706322941"
            aria-invalid={showError}
            aria-describedby={`tracking-error-${order.id}`}
            onChange={(event) => {
              setTrackingNumber(event.currentTarget.value.toUpperCase());
              if (event.currentTarget.value.trim()) setShowClientError(false);
            }}
            className={cls("w-full px-3 py-2 text-sm", showError && "border-red-400/70 bg-red-500/10")}
          />
          {showError && <div id={`tracking-error-${order.id}`} className="mt-1 text-xs text-red-200">{errorMessage}</div>}
        </div>
        <button className="rounded-lg border border-cyan/40 bg-cyan/20 px-3 py-2 text-sm font-medium text-cyan shadow-neon">Submit Tracking To Admin</button>
      </div>
    </form>
  );
}

function NewOrderModal({ accounts, buyGroups, workspaceId, onClose }: { accounts: AmazonAccount[]; buyGroups: BuyGroup[]; workspaceId: string; onClose: () => void }) {
  return (
    <Modal title="New Order" onClose={onClose}>
      <form action={createOrder} className="grid gap-4" onSubmit={() => setTimeout(onClose, 100)}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <OrderFields accounts={accounts} buyGroups={buyGroups} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm text-muted">Cancel</button>
          <button className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Create Order</button>
        </div>
      </form>
    </Modal>
  );
}

function OrderPanel({ order, accounts, buyGroups, workspaceId, workspaceName, memberStatus, isAdmin, onClose }: { order: OrderWithRelations; accounts: AmazonAccount[]; buyGroups: BuyGroup[]; workspaceId: string; workspaceName: string; memberStatus: string | null; isAdmin: boolean; onClose: () => void }) {
  const financials = calculateFinancials(order);
  const timeline = [
    ["Created", order.createdAt],
    ["Tracking sent to admin", order.memberSubmittedTrackingToAdminAt ?? order.trackingAddedAt],
    ...(isAdmin ? [["Submitted to warehouse", order.adminSubmittedTrackingToWarehouseAt ?? order.trackingSubmittedAt] as [string, Date | string | null | undefined]] : []),
    ["Delivered by member", order.memberMarkedDeliveredAt ?? order.deliveredAt],
    ["Scanned by warehouse", order.adminMarkedScannedByWarehouseAt ?? order.warehouseScannedAt ?? order.scannedAt],
    ...(isAdmin ? [["Paid out from warehouse", order.adminReceivedPayoutFromWarehouseAt ?? order.buyGroupPaidAdminAt ?? order.paidOutAt] as [string, Date | string | null | undefined]] : []),
    ["Paid to member", order.adminPaidMemberAt ?? order.memberPaidAt],
    ["Last Updated", order.updatedAt]
  ];

  return (
    <Modal title={order.itemName} onClose={onClose} wide>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <form action={updateOrder} className="grid gap-4" onSubmit={() => setTimeout(onClose, 100)}>
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <OrderFields accounts={accounts} buyGroups={buyGroups} order={order} lockTracking={isAdmin} />
          {isAdmin && (
            <div className="grid gap-3 rounded-lg border border-line bg-surface/60 p-4 md:grid-cols-2">
              <CheckField name="adminSubmittedTrackingToWarehouse" label="Submitted to warehouse" defaultChecked={order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted} />
              <CheckField name="adminMarkedScannedByWarehouse" label="Scanned by warehouse" defaultChecked={order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned} />
              <CheckField name="adminReceivedPayoutFromWarehouse" label="Paid out from warehouse" defaultChecked={order.adminReceivedPayoutFromWarehouse || order.buyGroupPaidAdmin || order.paidOut} />
              <CheckField name="adminPaidMember" label="Paid to member" defaultChecked={order.adminPaidMember || order.memberPaid} />
              <Field label="Member payout amount"><input name="memberPayoutAmount" type="number" min="0" step="0.01" defaultValue={order.memberPayoutAmount ?? financials.amountOwed} className="w-full px-3 py-2 text-sm" /></Field>
              <Field label="Admin-only notes" wide><textarea name="internalAdminNotes" defaultValue={order.internalAdminNotes ?? ""} rows={3} className="w-full resize-none px-3 py-2 text-sm" /></Field>
            </div>
          )}
          {!isAdmin && (
            <div className="grid gap-3 rounded-lg border border-line bg-surface/60 p-4 md:grid-cols-2">
              <CheckField name="memberMarkedDelivered" label="Delivered from Amazon" defaultChecked={order.memberMarkedDelivered || order.delivered} />
            </div>
          )}
          <Field label="Member-visible notes" wide><textarea name="memberVisibleNotes" defaultValue={order.memberVisibleNotes ?? ""} rows={3} className="w-full resize-none px-3 py-2 text-sm" /></Field>
          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs text-muted">Manual credit card due date</label>
              <input name="manualCreditCardDueDate" type="date" defaultValue={order.manualCreditCardDueDate ? new Date(order.manualCreditCardDueDate).toISOString().slice(0, 10) : ""} className="w-full px-3 py-2 text-sm" />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm text-muted">Cancel</button>
            <button className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Save Changes</button>
          </div>
        </form>
        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-surface/60 p-4">
            <div className="mb-3 text-sm font-semibold">Submission</div>
            <Fact label="Submitted by" value={memberName(order)} />
            <Fact label="Member email" value={order.submittedBy?.email ?? "Unknown"} />
            <Fact label="Workspace" value={workspaceName} />
            <Fact label="Member status" value={memberStatus ?? "Unknown"} />
            <Fact label="Member tracking" value={order.memberSubmittedTrackingToAdmin || order.trackingNumber ? "Sent to admin" : "Ordered / tracking needed"} />
            {isAdmin && <Fact label="Warehouse submission" value={order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted ? "Submitted to warehouse" : "Not submitted to warehouse"} />}
            <Fact label="Member delivered" value={yesNo(order.memberMarkedDelivered || order.delivered)} />
            <Fact label="Warehouse scanned" value={yesNo(order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned)} />
            {isAdmin && <Fact label="Warehouse paid admin" value={yesNo(order.adminReceivedPayoutFromWarehouse || order.buyGroupPaidAdmin || order.paidOut)} />}
            <Fact label="Paid to member" value={order.adminPaidMember || order.memberPaid ? "Yes" : "No"} />
            <Fact label="Member payout" value={money(order.memberPayoutAmount ?? financials.amountOwed)} />
          </div>
          <div className="rounded-lg border border-line bg-surface/60 p-4">
            <div className="mb-3 text-sm font-semibold">Financials</div>
            {(isAdmin ? [
              ["Total Paid", money(financials.totalPaid)],
              ["Total Payout", money(financials.totalPayout)],
              ["Chase Cashback", money(financials.chaseCashback)],
              ["Young Adult Cashback", money(financials.youngAdultCashback)],
              ["Total Cashback", money(financials.totalCashback)],
              ["Credit / Amount Owed", money(financials.amountOwed)],
              ["Estimated Profit", money(financials.profit)],
              ["Profit Status", order.creditCardPaid ? "Realized" : "Unrealized"]
            ] : [
              ["Member payout", money(order.memberPayoutAmount ?? financials.amountOwed)],
              ["Payment status", order.adminPaidMember || order.memberPaid ? "Paid" : "Open"]
            ]).map(([label, value]) => <Fact key={label} label={label} value={value} />)}
          </div>
          <div className="rounded-lg border border-line bg-surface/60 p-4">
            <div className="mb-3 text-sm font-semibold">Status History</div>
            {timeline.map(([label, value]) => <Fact key={label as string} label={label as string} value={dateTime(value as Date | null)} />)}
          </div>
          <form
            action={deleteOrder}
            onSubmit={(event) => {
              if (!window.confirm(`Delete "${order.itemName}"? This cannot be undone.`)) {
                event.preventDefault();
                return;
              }
              setTimeout(onClose, 100);
            }}
            className="rounded-lg border border-slate-400/30 bg-slate-500/10 p-4"
          >
            <input type="hidden" name="id" value={order.id} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <div className="mb-2 text-sm font-semibold text-white">Delete Entry</div>
            <p className="mb-3 text-sm text-slate-300">Remove this order from the local database.</p>
            <button className="rounded-lg border border-slate-300/40 px-3 py-2 text-sm font-medium text-white hover:bg-white/10">Delete Order</button>
          </form>
        </aside>
      </div>
    </Modal>
  );
}

function OrderFields({ accounts, buyGroups, order, lockTracking = false }: { accounts: AmazonAccount[]; buyGroups: BuyGroup[]; order?: OrderWithRelations; lockTracking?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Item name"><input name="itemName" required defaultValue={order?.itemName ?? ""} className="w-full px-3 py-2 text-sm" /></Field>
      <Field label="Quantity"><input name="quantity" required type="number" min="1" defaultValue={order?.quantity ?? 1} className="w-full px-3 py-2 text-sm" /></Field>
      <Field label="Amazon account">
        <select name="amazonAccountId" defaultValue={order?.amazonAccountId ?? ""} className="w-full px-3 py-2 text-sm">
          <option value="">Select account</option>
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Buy group / destination">
        <select name="buyGroupId" defaultValue={order?.buyGroupId ?? ""} className="w-full px-3 py-2 text-sm">
          <option value="">Select buy group / destination</option>
          {buyGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Retail price per unit"><input name="retailPrice" required type="number" min="0" step="0.01" defaultValue={order?.retailPrice ?? ""} className="w-full px-3 py-2 text-sm" /></Field>
      <Field label="Payout per unit"><input name="payoutPerUnit" required type="number" min="0" step="0.01" defaultValue={order?.payoutPerUnit ?? ""} className="w-full px-3 py-2 text-sm" /></Field>
      <Field label="Order number"><input name="orderNumber" defaultValue={order?.orderNumber ?? ""} placeholder="Ex: 114-3361283-3021808" inputMode="numeric" maxLength={19} pattern="\d{3}-\d{7}-\d{7}" title="Use the format 114-3361283-3021808" onInput={(event) => { event.currentTarget.value = formatAmazonOrderNumber(event.currentTarget.value); }} className="w-full px-3 py-2 text-sm" /></Field>
      <Field label="Tracking number"><input name="trackingNumber" defaultValue={order?.trackingNumber ?? ""} placeholder="Ex: TBA330706322941" disabled={lockTracking} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase(); }} className="w-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" /></Field>
      <Field label="Chase cashback">
        <select name="chaseCashbackPercent" defaultValue={order?.chaseCashbackPercent ?? 5} className="w-full px-3 py-2 text-sm">
          {[0, 5, 6, 7].map((value) => <option key={value} value={value}>{value}%</option>)}
          <option value="custom">Custom</option>
        </select>
      </Field>
      <Field label="Custom Chase %"><input name="customChaseCashbackPercent" type="number" min="0" step="0.01" placeholder="Only if custom" className="w-full px-3 py-2 text-sm" /></Field>
      <Field label="Shipping type"><input name="shippingType" defaultValue={order?.shippingType ?? ""} className="w-full px-3 py-2 text-sm" /></Field>
      <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
        <CheckField name="youngAdultEligible" label="Young Adult extra 5%" defaultChecked={order?.youngAdultEligible ?? false} />
        <CheckField name="sameTracking" label="Same tracking" defaultChecked={order?.sameTracking ?? false} />
      </div>
      <Field label="Notes" wide><textarea name="notes" defaultValue={order?.notes ?? ""} rows={3} className="w-full resize-none px-3 py-2 text-sm" /></Field>
    </div>
  );
}

function AccountsView({ accounts, orders, workspaceId }: { accounts: AmazonAccount[]; orders: OrderWithRelations[]; setSelectedOrder: (order: OrderWithRelations) => void; workspaceId: string }) {
  return (
    <div className="space-y-4">
      <form action={createAmazonAccount} className="rounded-lg border border-cyan/20 bg-panel/80 p-4 shadow-glow">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <div className="mb-3 flex items-center gap-2">
          <Plus size={17} className="text-blue-300" />
          <h2 className="font-semibold">Add Amazon Account</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <input name="name" required placeholder="Account name" className="w-full px-3 py-2 text-sm" />
          <input name="defaultCreditCardDueDays" type="number" min="1" defaultValue={7} className="w-full px-3 py-2 text-sm" aria-label="Default credit card due days" />
          <button className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Add Account</button>
        </div>
      </form>
      <SummaryGrid>
        {accounts.map((account) => {
          const accountOrders = orders.filter((order) => order.amazonAccountId === account.id);
          const summary = summarize(accountOrders);
          return (
            <div key={account.id} className="rounded-lg border border-cyan/20 bg-panel/80 p-4 shadow-glow">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{account.name}</h2>
                <CreditCard size={17} className="text-muted" />
              </div>
              <SummaryFacts summary={summary} />
              <form action={setAccountDefaultDueDays} className="mt-4 flex items-center gap-2">
                <input type="hidden" name="id" value={account.id} />
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input name="defaultCreditCardDueDays" type="number" min="1" defaultValue={account.defaultCreditCardDueDays ?? 7} className="w-20 px-2 py-1.5 text-sm" />
                <button className="rounded-md border border-line px-2 py-1.5 text-xs text-muted hover:text-white">Set card due days</button>
              </form>
            </div>
          );
        })}
      </SummaryGrid>
    </div>
  );
}

function BuyGroupsView({ buyGroups, orders, workspaceId }: { buyGroups: BuyGroup[]; orders: OrderWithRelations[]; workspaceId: string }) {
  return (
    <div className="space-y-4">
      <form action={createBuyGroup} className="rounded-lg border border-blue-400/20 bg-panel/80 p-4 shadow-glow">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <div className="mb-3 flex items-center gap-2">
          <Plus size={17} className="text-blue-300" />
          <h2 className="font-semibold">Add Buy Group / Destination</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input name="name" required placeholder="Buy group / destination name" className="w-full px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Add</button>
        </div>
      </form>
      <SummaryGrid>
        {buyGroups.map((group) => {
          const groupOrders = orders.filter((order) => order.buyGroupId === group.id);
          const summary = summarize(groupOrders);
          return (
            <div key={group.id} className="rounded-lg border border-blue-400/20 bg-panel/80 p-4 shadow-glow">
              <h2 className="mb-3 font-semibold">{group.name}</h2>
              <SummaryFacts summary={summary} />
              <Fact label="Delivered unpaid" value={String(groupOrders.filter((order) => order.delivered && !order.paidOut).length)} />
              <Fact label="Avg payout time" value={averageDays(groupOrders, "deliveredAt", "paidOutAt")} />
            </div>
          );
        })}
      </SummaryGrid>
    </div>
  );
}

function WarehousesView({ warehouses, orders }: { warehouses: Warehouse[]; orders: OrderWithRelations[] }) {
  return (
    <SummaryGrid>
      {warehouses.map((warehouse) => {
        const warehouseOrders = orders.filter((order) => order.warehouseId === warehouse.id);
        return (
          <div key={warehouse.id} className="rounded-lg border border-cyan/20 bg-panel/80 p-4 shadow-glow">
            <h2 className="mb-3 font-semibold">{warehouse.name}</h2>
            <Fact label="Total orders" value={String(warehouseOrders.length)} />
            <Fact label="Pending delivery" value={String(warehouseOrders.filter((order) => !order.delivered).length)} />
            <Fact label="Delivered" value={String(warehouseOrders.filter((order) => order.delivered).length)} />
            <Fact label="Scanned" value={String(warehouseOrders.filter((order) => order.scanned).length)} />
            <Fact label="Unpaid payout" value={String(warehouseOrders.filter((order) => order.scanned && !order.paidOut).length)} />
          </div>
        );
      })}
    </SummaryGrid>
  );
}

function OperatorQueues({ orders, setStage, setSection }: { orders: OrderWithRelations[]; setStage: (value: StageFilter) => void; setSection: (value: string) => void }) {
  const queues = [
    ["Waiting for Member Tracking", orders.filter((order) => !order.trackingNumber)],
    ["Tracking Received from Member", orders.filter((order) => order.trackingNumber && !(order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted))],
    ["Submitted to Warehouse", orders.filter((order) => order.adminSubmittedTrackingToWarehouse || order.trackingSubmitted)],
    ["Delivered by Member", orders.filter((order) => order.memberMarkedDelivered || order.delivered)],
    ["Waiting For Warehouse Scan", orders.filter((order) => (order.memberMarkedDelivered || order.delivered) && !(order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned))],
    ["Scanned by Warehouse", orders.filter((order) => order.adminMarkedScannedByWarehouse || order.warehouseScanned || order.scanned)],
    ["Paid Out from Warehouse", orders.filter((order) => (order.adminReceivedPayoutFromWarehouse || order.paidOut) && !(order.adminPaidMember || order.memberPaid))],
    ["Paid to Member", orders.filter((order) => order.adminPaidMember || order.memberPaid)],
    ["Done", orders.filter((order) => order.adminPaidMember || order.memberPaid || order.profitReceived)]
  ] as const;

  return (
    <SummaryGrid>
      {queues.map(([label, items]) => (
        <button
          key={label}
          onClick={() => {
            if (label.includes("Tracking Received")) setStage("TRACKING_READY");
            else if (label.includes("Submitted")) setStage("TRACKING_SUBMITTED");
            else if (label.includes("Done")) setStage("PROFIT_RECEIVED");
            else setStage("ALL");
            setSection("orders");
          }}
          className="rounded-lg border border-cyan/20 bg-panel/80 p-4 text-left shadow-glow hover:shadow-neon"
        >
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="mt-3 text-3xl font-semibold text-cyan">{items.length}</div>
        </button>
      ))}
    </SummaryGrid>
  );
}

function MembersView({ activeWorkspace, orders, workspaceMembers, profileId }: { activeWorkspace: WorkspaceSwitcherItem; orders: OrderWithRelations[]; workspaceMembers: WorkspaceMemberItem[]; profileId: string }) {
  const members = groupOrdersByMember(orders);
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-cyan/20 bg-panel/80 p-4 shadow-glow">
        <h2 className="font-semibold">Invite Members</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <input readOnly value={activeWorkspace.inviteCode} className="w-full px-3 py-2 text-sm" aria-label="Invite code" />
          <button type="button" onClick={() => navigator.clipboard?.writeText(activeWorkspace.inviteCode)} className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Copy Invite Code</button>
        </div>
      </section>
      <SummaryGrid>
        {workspaceMembers.map((member) => {
          const summary = members.find((item) => item.id === member.profileId);
          return (
          <div key={member.id} className="rounded-lg border border-line bg-panel/80 p-4 shadow-glow">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{member.name ?? member.email}</h2>
                <div className="mt-1 text-xs text-muted">{member.email}</div>
              </div>
              <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">{member.role}</span>
            </div>
            <Fact label="Status" value={member.status} />
            <Fact label="Orders" value={String(summary?.orders.length ?? 0)} />
            <Fact label="Unpaid owed" value={money(summary?.unpaid ?? 0)} />
            <Fact label="Paid" value={money(summary?.paid ?? 0)} />
            {member.role !== "OWNER" || member.profileId !== profileId ? (
              <form action={updateWorkspaceMemberStatus} className="mt-3">
                <input type="hidden" name="workspaceId" value={activeWorkspace.id} />
                <input type="hidden" name="memberId" value={member.id} />
                <input type="hidden" name="status" value={member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                <button className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-white">
                  {member.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                </button>
              </form>
            ) : null}
          </div>
        );})}
        {workspaceMembers.length === 0 && <div className="rounded-lg border border-dashed border-line p-8 text-muted">No members yet.</div>}
      </SummaryGrid>
    </div>
  );
}

function MemberPayoutsView({ orders }: { orders: OrderWithRelations[]; activeWorkspace: WorkspaceSwitcherItem }) {
  const members = groupOrdersByMember(orders);
  return (
    <div className="space-y-4">
      {members.map((member) => (
        <div key={member.id} className="rounded-lg border border-green-400/20 bg-panel/80 p-4 shadow-glow">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{member.name}</h2>
            <div className="text-right text-sm text-muted">Unpaid <span className="font-semibold text-white">{money(member.unpaid)}</span></div>
          </div>
          <div className="space-y-2">
            {member.orders.filter((order) => !(order.adminPaidMember || order.memberPaid)).map((order) => (
              <form key={order.id} action={quickAction} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface/60 px-3 py-2">
                <input type="hidden" name="workspaceId" value={order.workspaceId ?? ""} />
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="action" value="memberPaid" />
                <span className="text-sm">{order.itemName}</span>
                <span className="text-sm text-muted">{money(order.memberPayoutAmount ?? calculateFinancials(order).amountOwed)}</span>
                <button className="rounded-md border border-green-400/40 px-2.5 py-1.5 text-xs text-green-100">Mark Paid</button>
              </form>
            ))}
          </div>
        </div>
      ))}
      {members.length === 0 && <div className="rounded-lg border border-dashed border-line p-8 text-muted">No member payouts yet.</div>}
    </div>
  );
}

function TrackingNeededView({ orders }: { orders: OrderWithRelations[] }) {
  const trackingNeeded = orders.filter((order) => !order.trackingNumber);
  return (
    <div className="space-y-3">
      {trackingNeeded.map((order) => <OrderQueueCard key={order.id} order={order} stage="ALL" isAdmin={false} viewMode="member" memberSafe onOpen={() => undefined} />)}
      {trackingNeeded.length === 0 && <div className="rounded-lg border border-dashed border-line p-8 text-center text-muted">No ordered items need tracking.</div>}
    </div>
  );
}

function MyPayoutsView({ orders }: { orders: OrderWithRelations[] }) {
  const unpaid = orders.filter((order) => !(order.adminPaidMember || order.memberPaid));
  const paid = orders.filter((order) => order.adminPaidMember || order.memberPaid);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-green-400/20 bg-panel/80 p-4 shadow-glow">
        <div className="text-xs uppercase tracking-[.12em] text-muted">Amount Owed To Me</div>
        <div className="mt-2 text-3xl font-semibold">{money(unpaid.reduce((sum, order) => sum + (order.memberPayoutAmount ?? calculateFinancials(order).amountOwed), 0))}</div>
      </div>
      <div className="rounded-lg border border-line bg-panel/80 p-4 shadow-glow">
        <div className="text-xs uppercase tracking-[.12em] text-muted">Paid Orders</div>
        <div className="mt-2 text-3xl font-semibold">{paid.length}</div>
      </div>
      <div className="rounded-lg border border-line bg-panel/80 p-4 shadow-glow">
        <div className="text-xs uppercase tracking-[.12em] text-muted">Open Orders</div>
        <div className="mt-2 text-3xl font-semibold">{unpaid.length}</div>
      </div>
    </div>
  );
}

function groupOrdersByMember(orders: OrderWithRelations[]) {
  const map = new Map<string, { id: string; name: string; orders: OrderWithRelations[]; unpaid: number; paid: number }>();
  for (const order of orders) {
    const id = order.submittedBy?.id ?? "unknown";
    const name = memberName(order);
    const existing = map.get(id) ?? { id, name, orders: [], unpaid: 0, paid: 0 };
    const amount = order.memberPayoutAmount ?? calculateFinancials(order).amountOwed;
    existing.orders.push(order);
    if (order.adminPaidMember || order.memberPaid) existing.paid += amount;
    else existing.unpaid += amount;
    map.set(id, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.unpaid - a.unpaid);
}

function AnalyticsView({ orders }: { orders: OrderWithRelations[] }) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const groups = [
    ["Realized profit by Amazon account", groupProfit(orders, (order) => order.amazonAccount?.name ?? "Missing account", "realized")],
    ["Unrealized profit by Amazon account", groupProfit(orders, (order) => order.amazonAccount?.name ?? "Missing account", "unrealized")],
    ["Realized profit by buy group", groupProfit(orders, (order) => order.buyGroup?.name ?? "Missing buy group", "realized")],
    ["Unrealized profit by buy group", groupProfit(orders, (order) => order.buyGroup?.name ?? "Missing buy group", "unrealized")],
    ["Realized profit by destination", groupProfit(orders, (order) => order.buyGroup?.name ?? order.warehouse?.name ?? "Missing destination", "realized")],
    ["Unrealized profit by destination", groupProfit(orders, (order) => order.buyGroup?.name ?? order.warehouse?.name ?? "Missing destination", "unrealized")]
  ];
  const calendarDays = buildAnalyticsCalendar(orders, visibleMonth);
  const profitSeries = buildProfitSeries(orders);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(visibleMonth);
  const monthProfit = calendarDays.reduce((sum, day) => sum + day.realizedProfit, 0);
  const monthEvents = calendarDays.reduce((sum, day) => sum + day.eventCount, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-cyan/20 bg-panel/80 p-4 shadow-glow">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Operations Calendar</h2>
            <div className="mt-1 text-sm text-muted">Ordered, delivered, scanned, paid out, card paid, and realized profit days.</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-white">Prev</button>
            <button onClick={() => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-white">Today</button>
            <button onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-white">Next</button>
          </div>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface/60 p-3">
            <div className="text-xs uppercase tracking-[.12em] text-muted">Month</div>
            <div className="mt-1 text-xl font-semibold">{monthLabel}</div>
          </div>
          <div className="rounded-lg border border-green-400/30 bg-green-500/10 p-3">
            <div className="text-xs uppercase tracking-[.12em] text-muted">Realized Profit</div>
            <div className="mt-1 text-xl font-semibold text-white">{money(monthProfit)}</div>
          </div>
          <div className="rounded-lg border border-blue-400/25 bg-blue-500/10 p-3">
            <div className="text-xs uppercase tracking-[.12em] text-muted">Workflow Events</div>
            <div className="mt-1 text-xl font-semibold text-white">{monthEvents}</div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="bg-surface px-2 py-2 text-center text-xs font-semibold uppercase tracking-[.12em] text-muted">{day}</div>
          ))}
          {calendarDays.map((day) => (
            <div key={day.key} className={cls("min-h-32 bg-surface/90 p-2", day.inMonth ? "" : "opacity-35", day.realizedProfit > 0 ? "bg-green-500/18" : day.eventCount > 0 ? "bg-blue-500/10" : "")}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{day.date.getDate()}</span>
                {day.realizedProfit > 0 && <span className="rounded-md bg-green-500/20 px-1.5 py-0.5 text-[11px] text-green-100">{money(day.realizedProfit)}</span>}
              </div>
              <div className="space-y-1 text-[11px] leading-tight text-slate-300">
                {day.ordered > 0 && <div>Ordered: {day.ordered}</div>}
                {day.delivered > 0 && <div>Delivered: {day.delivered}</div>}
                {day.scanned > 0 && <div>Scanned: {day.scanned}</div>}
                {day.paidOut > 0 && <div>Paid out: {day.paidOut}</div>}
                {day.cardPaid > 0 && <div className="text-green-100">Card paid: {day.cardPaid}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ProfitChart series={profitSeries} />

      <div className="grid gap-4 xl:grid-cols-3">
        {groups.map(([title, rows]) => (
          <div key={title as string} className="rounded-lg border border-cyan/20 bg-panel/80 p-4 shadow-glow">
            <h2 className="mb-3 font-semibold">{title as string}</h2>
            {(rows as Array<[string, number]>).map(([label, value]) => <Fact key={label} label={label} value={money(value)} />)}
          </div>
        ))}
        <div className="rounded-lg border border-slate-500/30 bg-panel/80 p-4 shadow-glow">
          <h2 className="mb-3 font-semibold">Cycle Times</h2>
          <Fact label="Delivered to paid out" value={averageDays(orders, "deliveredAt", "paidOutAt")} />
          <Fact label="Ordered to tracking submitted" value={averageDays(orders, "createdAt", "trackingSubmittedAt")} />
          <Fact label="Paid out to credit paid" value={averageDays(orders, "paidOutAt", "creditCardPaidAt")} />
        </div>
      </div>
    </div>
  );
}

function ImportExportView({ orders }: { orders: OrderWithRelations[] }) {
  const csv = useMemo(() => {
    const header = ["item", "quantity", "account", "buy_group_destination", "order_number", "tracking", "stage", "total_paid", "total_payout", "amount_owed", "estimated_profit", "profit_status"];
    const rows = orders.map((order) => {
      const financials = calculateFinancials(order);
      return [order.itemName, order.quantity, order.amazonAccount?.name ?? "", order.buyGroup?.name ?? order.warehouse?.name ?? "", order.orderNumber ?? "", order.trackingNumber ?? "", order.currentStage, financials.totalPaid, financials.totalPayout, financials.amountOwed, financials.profit, order.creditCardPaid ? "realized" : "unrealized"];
    });
    return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  }, [orders]);

  return (
    <div className="rounded-lg border border-cyan/20 bg-panel/80 p-5 shadow-glow">
      <h2 className="mb-2 font-semibold">Import / Export</h2>
      <p className="mb-4 text-sm text-muted">CSV import is intentionally parked for v1. Export is available for backups and review.</p>
      <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download="buy-group-orders.csv" className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">
        <Download size={16} />
        Export All Orders
      </a>
    </div>
  );
}

function dateKey(date: Date | string) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function buildAnalyticsCalendar(orders: OrderWithRelations[], visibleMonth: Date) {
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: dateKey(date),
      date,
      inMonth: date.getMonth() === visibleMonth.getMonth(),
      ordered: 0,
      delivered: 0,
      scanned: 0,
      paidOut: 0,
      cardPaid: 0,
      realizedProfit: 0,
      eventCount: 0
    };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  const bump = (date: Date | string | null, field: "ordered" | "delivered" | "scanned" | "paidOut" | "cardPaid", amount = 0) => {
    if (!date) return;
    const day = byKey.get(dateKey(date));
    if (!day) return;
    day[field] += 1;
    day.eventCount += 1;
    if (field === "cardPaid") day.realizedProfit += amount;
  };

  for (const order of orders) {
    const financials = calculateFinancials(order);
    bump(order.createdAt, "ordered");
    bump(order.deliveredAt, "delivered");
    bump(order.scannedAt, "scanned");
    bump(order.paidOutAt, "paidOut");
    if (order.creditCardPaid) bump(order.creditCardPaidAt, "cardPaid", financials.profit);
  }

  return days;
}

function buildProfitSeries(orders: OrderWithRelations[]) {
  const daily = new Map<string, number>();
  for (const order of orders) {
    if (!order.creditCardPaid || !order.creditCardPaidAt) continue;
    const key = dateKey(order.creditCardPaidAt);
    daily.set(key, (daily.get(key) ?? 0) + calculateFinancials(order).profit);
  }

  const entries = Array.from(daily.entries()).sort(([a], [b]) => a.localeCompare(b));
  let cumulative = 0;
  return entries.map(([key, value]) => {
    cumulative += value;
    return { key, date: new Date(`${key}T00:00:00`), dailyProfit: value, cumulativeProfit: cumulative };
  });
}

function ProfitChart({ series }: { series: ReturnType<typeof buildProfitSeries> }) {
  const width = 900;
  const height = 260;
  const padding = 36;
  const maxProfit = Math.max(1, ...series.map((point) => point.cumulativeProfit));
  const points = series.map((point, index) => {
    const x = series.length === 1 ? padding : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.cumulativeProfit / maxProfit) * (height - padding * 2);
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

  return (
    <section className="rounded-lg border border-green-400/20 bg-panel/80 p-4 shadow-glow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Realized Profit Curve</h2>
          <div className="mt-1 text-sm text-muted">Cumulative realized profit by credit card paid date.</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[.12em] text-muted">Total</div>
          <div className="text-xl font-semibold text-green-100">{money(series.at(-1)?.cumulativeProfit ?? 0)}</div>
        </div>
      </div>
      {series.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-8 text-center text-muted">No realized profit yet. Mark credit cards paid to populate this chart.</div>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px] rounded-lg border border-line bg-surface/70">
            {[0, 1, 2, 3].map((tick) => {
              const y = padding + tick * ((height - padding * 2) / 3);
              const value = maxProfit - tick * (maxProfit / 3);
              return (
                <g key={tick}>
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(148,163,184,.18)" />
                  <text x={padding - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{money(value)}</text>
                </g>
              );
            })}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(148,163,184,.35)" />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(148,163,184,.35)" />
            <path d={path} fill="none" stroke="#3ddc84" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => (
              <g key={point.key}>
                <circle cx={point.x} cy={point.y} r="5" fill="#3ddc84" stroke="#0b1220" strokeWidth="2" />
                {(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0) && (
                  <text x={point.x} y={height - 12} textAnchor="middle" className="fill-slate-400 text-[11px]">{shortDate(point.date)}</text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}

function SettingsView({ profile, activeWorkspace, workspaces }: { profile: Props["profile"]; activeWorkspace: WorkspaceSwitcherItem; workspaces: WorkspaceSwitcherItem[] }) {
  const hasPersonalWorkspace = workspaces.some((workspace) => workspace.type === "PERSONAL");
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-cyan/20 bg-panel/80 p-5 shadow-glow">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <form action={updateProfile} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input name="firstName" defaultValue={profile.firstName ?? ""} placeholder="First name" className="w-full px-3 py-2 text-sm" />
          <input name="lastName" defaultValue={profile.lastName ?? ""} placeholder="Last name" className="w-full px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Save Profile</button>
        </form>
        <div className="mt-3 text-sm text-muted">Signed in as {profile.email}</div>
      </section>

      <section className="rounded-lg border border-blue-400/20 bg-panel/80 p-5 shadow-glow">
        <h2 className="mb-4 font-semibold">Workspaces</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <form action={createPersonalWorkspaceFromApp} className="rounded-lg border border-line bg-surface/60 p-4">
            <h3 className="font-semibold">Create Personal Workspace</h3>
            <p className="mt-2 min-h-16 text-sm text-muted">Track your own direct orders separately from operator/member workspaces.</p>
            <button disabled={hasPersonalWorkspace} className="mt-4 rounded-lg border border-cyan/40 bg-cyan/15 px-3 py-2 text-sm font-medium text-cyan disabled:cursor-not-allowed disabled:opacity-45">
              {hasPersonalWorkspace ? "Personal Exists" : "Create Personal"}
            </button>
          </form>
          <form action={createOperatorWorkspaceFromApp} className="rounded-lg border border-line bg-surface/60 p-4">
            <h3 className="font-semibold">Create Operator Workspace</h3>
            <p className="mt-2 text-sm text-muted">Manage orders from friends or sub-sellers.</p>
            <input name="workspaceName" required placeholder="Sai Buy Group Ops" className="mt-3 w-full px-3 py-2 text-sm" />
            <input name="operatorCreationCode" required type="password" placeholder="Operator access code" className="mt-3 w-full px-3 py-2 text-sm" />
            <button className="mt-4 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white">Create Operator</button>
          </form>
          <form action={joinOperatorWorkspaceFromApp} className="rounded-lg border border-line bg-surface/60 p-4">
            <h3 className="font-semibold">Join Operator Workspace</h3>
            <p className="mt-2 text-sm text-muted">Enter an invite code from an operator.</p>
            <input name="inviteCode" required placeholder="Invite code" className="mt-3 w-full px-3 py-2 text-sm" />
            <button className="mt-4 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white">Join Workspace</button>
          </form>
        </div>
        {activeWorkspace.type === "OPERATOR" && (
          <div className="mt-4 rounded-lg border border-line bg-surface/60 p-4 text-sm text-muted">
            Current operator invite code: <span className="font-semibold text-white">{activeWorkspace.inviteCode}</span>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-500/30 bg-panel/80 p-5 shadow-glow">
        <h2 className="mb-4 font-semibold">Notification Settings</h2>
        {["In-app only", "Email", "Google Calendar", "n8n webhook"].map((label, index) => (
          <label key={label} className="mb-3 flex items-center gap-3 rounded-lg border border-line bg-surface/60 px-3 py-3">
            <input type="radio" name="notifications" defaultChecked={index === 0} />
            <span>{label}</span>
            {index > 0 && <span className="ml-auto text-xs text-muted">Placeholder</span>}
          </label>
        ))}
        <div className="mt-4 rounded-lg border border-line bg-surface/60 p-4 text-sm text-muted">
          Future credentials belong in `.env`: email API key, Google OAuth credentials, and webhook URLs. Missing integrations are skipped safely.
        </div>
      </section>
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur">
      <div className={cls("max-h-[92vh] w-full overflow-auto rounded-xl border border-line bg-panel p-5 shadow-glow", wide ? "max-w-6xl" : "max-w-3xl")}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-white">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cls("block", wide && "md:col-span-2")}>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function CheckField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-line bg-surface/60 px-3 py-2 text-sm">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/70 py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SummaryGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function SummaryFacts({ summary }: { summary: ReturnType<typeof summarize> }) {
  return (
    <>
      <Fact label="Total orders" value={String(summary.totalOrders)} />
      <Fact label="Open orders" value={String(summary.openOrders)} />
      <Fact label="Total spent" value={money(summary.totalSpent)} />
      <Fact label="Payout expected" value={money(summary.totalPayout)} />
      <Fact label="Total cashback" value={money(summary.totalCashback)} />
      <Fact label="Amount owed" value={money(summary.amountOwed)} />
      <Fact label="Realized profit" value={money(summary.realizedProfit)} />
      <Fact label="Unrealized profit" value={money(summary.unrealizedProfit)} />
      <Fact label="Unpaid card amount" value={money(summary.unpaidCard)} />
      <Fact label="Needs action" value={String(summary.needsAction)} />
    </>
  );
}

function summarize(orders: OrderWithRelations[]) {
  return orders.reduce(
    (acc, order) => {
      const financials = calculateFinancials(order);
      acc.totalOrders += 1;
      if (!order.profitReceived) acc.openOrders += 1;
      acc.totalSpent += financials.totalPaid;
      acc.totalPayout += financials.totalPayout;
      acc.totalCashback += financials.totalCashback;
      acc.amountOwed += financials.amountOwed;
      if (order.creditCardPaid) acc.realizedProfit += financials.profit;
      if (!order.creditCardPaid && !order.profitReceived) acc.unrealizedProfit += financials.profit;
      if (order.paidOut && !order.creditCardPaid) acc.unpaidCard += financials.amountOwed;
      if ((order.trackingNumber && !order.trackingSubmitted) || (order.delivered && !order.paidOut) || (order.paidOut && !order.creditCardPaid)) acc.needsAction += 1;
      return acc;
    },
    { totalOrders: 0, openOrders: 0, totalSpent: 0, totalPayout: 0, totalCashback: 0, amountOwed: 0, realizedProfit: 0, unrealizedProfit: 0, unpaidCard: 0, needsAction: 0 }
  );
}

function groupProfit(orders: OrderWithRelations[], keyer: (order: OrderWithRelations) => string, mode: "realized" | "unrealized") {
  const map = new Map<string, number>();
  for (const order of orders) {
    if (mode === "realized" && !order.creditCardPaid) continue;
    if (mode === "unrealized" && (order.creditCardPaid || order.profitReceived)) continue;
    map.set(keyer(order), (map.get(keyer(order)) ?? 0) + calculateFinancials(order).profit);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function averageDays(orders: OrderWithRelations[], startKey: keyof OrderWithRelations, endKey: keyof OrderWithRelations) {
  const values = orders
    .map((order) => {
      const start = order[startKey];
      const end = order[endKey];
      if (!start || !end) return null;
      return (new Date(end as Date).getTime() - new Date(start as Date).getTime()) / 86400000;
    })
    .filter((value): value is number => value !== null);

  if (values.length === 0) return "Not enough data";
  return `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)} days`;
}
