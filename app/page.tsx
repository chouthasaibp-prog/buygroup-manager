import { prisma } from "@/lib/db";
import { buildReminders, calculateFinancials } from "@/lib/domain";
import CommandCenter from "@/components/CommandCenter";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [orders, accounts, buyGroups, warehouses] = await Promise.all([
    prisma.order.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { amazonAccount: true, buyGroup: true, warehouse: true }
    }),
    prisma.amazonAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.buyGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } })
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
    />
  );
}
