import { prisma } from "@/lib/db";
import type { OrderStage } from "@prisma/client";
import { buildReminders, calculateFinancials, calculatePayoutBreakdown } from "@/lib/domain";
import { displayProfileName, getWorkspaceContext, orderVisibilityWhere } from "@/lib/workspace";
import CommandCenter from "@/components/CommandCenter";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ workspace?: string }>;
};

const orderInclude = { amazonAccount: true, creditCard: true, buyGroup: true, warehouse: true, submittedBy: true, reminderStates: true } as const;
const orderIncludeWithoutReminderState = { amazonAccount: true, creditCard: true, buyGroup: true, warehouse: true, submittedBy: true } as const;

async function findOrdersWithReminderStateFallback(where: ReturnType<typeof orderVisibilityWhere>) {
  try {
    return await prisma.order.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: orderInclude
    });
  } catch (error) {
    console.error("ReminderState relation failed while loading orders; falling back without reminder state.", error);
    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: orderIncludeWithoutReminderState
    });
    return orders.map((order) => ({ ...order, reminderStates: [] }));
  }
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const context = await getWorkspaceContext(params.workspace);
  const workspaceWhere = { workspaceId: context.activeWorkspace.id };
  const orderWhere = orderVisibilityWhere(context);
  const viewMode = context.activeWorkspace.type === "PERSONAL" ? "personal" : context.isAdmin ? "admin" : "member";
  const [orders, accounts, creditCards, buyGroups, warehouses, workspaceMembers, trackingChangeAlerts, deliveryBeforeTrackingAlerts] = await Promise.all([
    findOrdersWithReminderStateFallback(orderWhere),
    prisma.amazonAccount.findMany({ where: workspaceWhere, orderBy: { name: "asc" } }),
    viewMode === "admin"
      ? Promise.resolve([])
      : prisma.creditCard.findMany({
          where: { ...workspaceWhere, userId: context.profile.id },
          orderBy: { name: "asc" }
        }),
    prisma.buyGroup.findMany({ where: workspaceWhere, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: workspaceWhere, orderBy: { name: "asc" } }),
    context.isAdmin
      ? prisma.workspaceMember.findMany({
          where: { workspaceId: context.activeWorkspace.id },
          include: { profile: true },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }]
        })
      : Promise.resolve([]),
    context.isAdmin && context.activeWorkspace.type === "OPERATOR"
      ? prisma.trackingChangeAlert.findMany({
          where: {
            workspaceId: context.activeWorkspace.id,
            reviewedAt: null,
            OR: [
              { snoozedUntil: null },
              { snoozedUntil: { lte: new Date() } }
            ]
          },
          orderBy: { changedAt: "desc" },
          include: {
            order: { include: orderInclude },
            member: true
          }
        }).catch(() => [])
      : Promise.resolve([]),
    context.isAdmin && context.activeWorkspace.type === "OPERATOR"
      ? prisma.deliveryBeforeTrackingAlert.findMany({
          where: {
            workspaceId: context.activeWorkspace.id,
            reviewedAt: null,
            OR: [
              { snoozedUntil: null },
              { snoozedUntil: { lte: new Date() } }
            ]
          },
          orderBy: { deliveredAt: "asc" },
          include: {
            order: { include: orderInclude },
            member: true
          }
        }).catch(() => [])
      : Promise.resolve([])
  ]);

  const visibleOrders = context.isAdmin ? orders : orders.map((order) => {
    const memberPayoutPerUnit = order.memberPayoutPerUnit ?? order.payoutPerUnit;
    const memberTotalPayout = order.memberTotalPayout ?? memberPayoutPerUnit * order.quantity;

    return {
      ...order,
      payoutPerUnit: memberPayoutPerUnit,
      warehousePayoutPerUnit: null,
      warehouseTotalPayout: null,
      memberPayoutPerUnit,
      memberTotalPayout,
      adminSpreadPerUnit: null,
      adminTotalSpread: null,
      adminSpreadPercent: null,
      adminProfit: null,
      adminMargin: null,
    trackingSubmitted: false,
    trackingSubmittedAt: null,
    scanned: false,
    scannedAt: null,
    paidOut: false,
    paidOutAt: null,
    creditCardPaid: false,
    creditCardPaidAt: null,
    profitReceived: order.memberMarkedDone || order.profitReceived,
    profitReceivedAt: order.memberMarkedDoneAt ?? order.profitReceivedAt,
    payoutReminderSnoozedAt: null,
    manualCreditCardDueDate: null,
    internalAdminNotes: null,
    adminSubmittedTrackingToBuyGroup: false,
    adminSubmittedTrackingToBuyGroupAt: null,
    adminSubmittedTrackingToWarehouse: false,
    adminSubmittedTrackingToWarehouseAt: null,
    warehouseScanned: order.adminMarkedScannedByWarehouse || order.warehouseScanned,
    warehouseScannedAt: order.adminMarkedScannedByWarehouse || order.warehouseScanned ? order.adminMarkedScannedByWarehouseAt ?? order.warehouseScannedAt ?? order.scannedAt : null,
    adminMarkedScannedByWarehouse: order.adminMarkedScannedByWarehouse || order.warehouseScanned,
    adminMarkedScannedByWarehouseAt: order.adminMarkedScannedByWarehouse || order.warehouseScanned ? order.adminMarkedScannedByWarehouseAt ?? order.warehouseScannedAt ?? order.scannedAt : null,
    buyGroupPaidAdmin: false,
    buyGroupPaidAdminAt: null,
    adminReceivedPayoutFromWarehouse: false,
    adminReceivedPayoutFromWarehouseAt: null,
    adminPaidMember: order.adminPaidMember || order.memberPaid,
    adminPaidMemberAt: order.adminPaidMember || order.memberPaid ? order.adminPaidMemberAt ?? order.memberPaidAt : null,
    memberPayoutAmount: order.memberPayoutAmount ?? memberTotalPayout,
    currentStage: (order.memberMarkedDone || order.profitReceived
      ? "PROFIT_RECEIVED"
      : order.adminMarkedScannedByWarehouse || order.warehouseScanned
        ? "SCANNED"
        : order.memberMarkedDelivered || order.delivered
          ? "DELIVERED"
          : order.trackingNumber
            ? "TRACKING_READY"
            : "ORDERED") as OrderStage
    };
  });
  const reminders = buildReminders(visibleOrders, new Date(), viewMode);
  const openOrders = visibleOrders.filter((order) => viewMode === "admin"
    ? !(order.adminPaidMember || order.memberPaid || order.profitReceived)
    : viewMode === "member"
      ? !(order.memberMarkedDone || order.profitReceived)
      : !order.profitReceived);
  const totals = visibleOrders.reduce(
    (acc, order) => {
      const financials = calculateFinancials(order);
      const payout = calculatePayoutBreakdown(order);

      if (viewMode === "admin") {
        const adminDone = order.adminPaidMember || order.memberPaid || order.profitReceived;
        const warehousePaid = order.adminReceivedPayoutFromWarehouse || order.paidOut;
        const memberPaid = order.adminPaidMember || order.memberPaid;

        acc.totalSpent += financials.totalPaid;
        acc.totalPayout += payout.warehouseTotalPayout;
        if (!adminDone && !warehousePaid) acc.warehousePayoutExpected += payout.warehouseTotalPayout;
        if (!adminDone && !memberPaid) {
          acc.memberPayoutOwed += order.memberPayoutAmount ?? payout.memberTotalPayout;
          acc.amountOwed += order.memberPayoutAmount ?? payout.memberTotalPayout;
        }
        if (adminDone || (warehousePaid && memberPaid)) {
          acc.adminSpreadRealized += payout.adminTotalSpread;
          acc.realizedProfit += payout.adminTotalSpread;
        } else if (!adminDone) {
          acc.adminSpreadUnrealized += payout.adminTotalSpread;
          acc.unrealizedProfit += payout.adminTotalSpread;
        }
        return acc;
      }

      if (viewMode === "member") {
        const memberDone = order.memberMarkedDone || order.profitReceived;
        const memberPaid = order.adminPaidMember || order.memberPaid;
        const paymentConfirmed = order.memberConfirmedPayment || memberDone;

        acc.totalSpent += financials.totalPaid;
        acc.totalPayout += payout.memberTotalPayout;
        acc.totalCashback += financials.totalCashback;
        if (!memberDone && !memberPaid) {
          acc.expectedMemberPayout += order.memberPayoutAmount ?? payout.memberTotalPayout;
          acc.amountOwed += order.memberPayoutAmount ?? payout.memberTotalPayout;
        }
        if (order.memberConfirmedPayment && !memberDone) acc.memberPayoutOwed += financials.amountOwed;
        const memberTotalPayout = order.memberPayoutAmount ?? payout.memberTotalPayout;
        const memberMainProfit = order.youngAdultBalanceUsed ? 0 : financials.chaseCashback + memberTotalPayout - financials.totalPaid;
        const memberProfit = memberMainProfit + financials.youngAdultProfit;
        if (paymentConfirmed) acc.realizedProfit += memberProfit;
        else if (!memberDone) acc.unrealizedProfit += memberProfit;
        return acc;
      }

      acc.totalSpent += financials.totalPaid;
      acc.totalCashback += financials.totalCashback;

      if (!order.profitReceived) {
        acc.totalPayout += financials.totalPayout;
        if (!order.paidOut) acc.warehousePayoutExpected += financials.totalPayout;
        acc.memberPayoutOwed += payout.memberTotalPayout;
        acc.expectedMemberPayout += payout.memberTotalPayout;
        if (!order.creditCardPaid) acc.amountOwed += financials.amountOwed;
      }

      if (order.creditCardPaid || order.profitReceived) {
        acc.realizedProfit += financials.profit;
      } else if (!order.profitReceived) {
        acc.unrealizedProfit += financials.profit;
      }

      return acc;
    },
    { totalSpent: 0, totalPayout: 0, totalCashback: 0, amountOwed: 0, realizedProfit: 0, unrealizedProfit: 0, warehousePayoutExpected: 0, memberPayoutOwed: 0, adminSpreadRealized: 0, adminSpreadUnrealized: 0, expectedMemberPayout: 0 }
  );

  return (
    <CommandCenter
      orders={visibleOrders}
      accounts={accounts}
      creditCards={creditCards}
      buyGroups={buyGroups}
      warehouses={warehouses}
      reminders={reminders}
      trackingChangeAlerts={trackingChangeAlerts}
      deliveryBeforeTrackingAlerts={deliveryBeforeTrackingAlerts}
      totals={{ ...totals, openOrders: openOrders.length, overdueReminders: reminders.filter((item) => item.severity === "overdue").length }}
      userEmail={context.profile.email}
      profile={{
        firstName: context.profile.firstName,
        lastName: context.profile.lastName,
        name: displayProfileName(context.profile),
        email: context.profile.email
      }}
      workspaces={context.memberships.map((membership) => ({
        id: membership.workspaceId,
        name: membership.workspace.name,
        type: membership.workspace.type,
        role: membership.role,
        inviteCode: membership.workspace.inviteCode
      }))}
      activeWorkspace={{
        id: context.activeWorkspace.id,
        name: context.activeWorkspace.name,
        type: context.activeWorkspace.type,
        role: context.role,
        inviteCode: context.activeWorkspace.inviteCode
      }}
      profileId={context.profile.id}
      isAdmin={context.isAdmin}
      notificationSettings={{
        emailNotificationsEnabled: context.activeMembership.emailNotificationsEnabled,
        slackNotificationsEnabled: context.activeMembership.slackNotificationsEnabled,
        reminderNotificationsEnabled: context.activeMembership.reminderNotificationsEnabled
      }}
      workspaceMembers={workspaceMembers.map((membership) => ({
        id: membership.id,
        profileId: membership.profileId,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt?.toISOString() ?? null,
        firstName: membership.profile.firstName,
        lastName: membership.profile.lastName,
        name: displayProfileName(membership.profile),
        email: membership.profile.email
      }))}
    />
  );
}
