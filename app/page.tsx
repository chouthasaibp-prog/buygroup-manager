import { prisma } from "@/lib/db";
import { buildReminders, calculateFinancials } from "@/lib/domain";
import { getWorkspaceContext, orderVisibilityWhere } from "@/lib/workspace";
import CommandCenter from "@/components/CommandCenter";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ workspace?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const context = await getWorkspaceContext(params.workspace);
  const workspaceWhere = { workspaceId: context.activeWorkspace.id };
  const orderWhere = orderVisibilityWhere(context);
  const [orders, accounts, buyGroups, warehouses, workspaceMembers] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      orderBy: [{ updatedAt: "desc" }],
      include: { amazonAccount: true, buyGroup: true, warehouse: true, submittedBy: true }
    }),
    prisma.amazonAccount.findMany({ where: workspaceWhere, orderBy: { name: "asc" } }),
    prisma.buyGroup.findMany({ where: workspaceWhere, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: workspaceWhere, orderBy: { name: "asc" } }),
    context.isAdmin
      ? prisma.workspaceMember.findMany({
          where: { workspaceId: context.activeWorkspace.id },
          include: { profile: true },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }]
        })
      : Promise.resolve([])
  ]);

  const reminders = buildReminders(orders);
  const openOrders = orders.filter((order) => !order.profitReceived);
  const totals = orders.reduce(
    (acc, order) => {
      const financials = calculateFinancials(order);
      if (!order.profitReceived) {
        acc.totalSpent += financials.totalPaid;
        acc.totalPayout += financials.totalPayout;
        acc.totalCashback += financials.totalCashback;
        acc.amountOwed += financials.amountOwed;
      }

      if (order.creditCardPaid) {
        acc.realizedProfit += financials.profit;
      } else if (!order.profitReceived) {
        acc.unrealizedProfit += financials.profit;
      }

      return acc;
    },
    { totalSpent: 0, totalPayout: 0, totalCashback: 0, amountOwed: 0, realizedProfit: 0, unrealizedProfit: 0 }
  );

  return (
    <CommandCenter
      orders={orders}
      accounts={accounts}
      buyGroups={buyGroups}
      warehouses={warehouses}
      reminders={reminders}
      totals={{ ...totals, openOrders: openOrders.length, overdueReminders: reminders.filter((item) => item.severity === "overdue").length }}
      userEmail={context.profile.email}
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
      workspaceMembers={workspaceMembers.map((membership) => ({
        id: membership.id,
        profileId: membership.profileId,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt?.toISOString() ?? null,
        name: membership.profile.name,
        email: membership.profile.email
      }))}
    />
  );
}
