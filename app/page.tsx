import { prisma } from "@/lib/db";
import { buildReminders, calculateFinancials } from "@/lib/domain";
import { requireUser } from "@/lib/supabase/server";
import CommandCenter from "@/components/CommandCenter";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const userId = user.id;
  const [orders, accounts, buyGroups, warehouses] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
      include: { amazonAccount: true, buyGroup: true, warehouse: true }
    }),
    prisma.amazonAccount.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.buyGroup.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: { userId }, orderBy: { name: "asc" } })
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
      userEmail={user.email ?? "Signed in"}
    />
  );
}
