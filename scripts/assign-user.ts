import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const userId = process.argv[2];

if (!userId) {
  console.error("Usage: npm run data:assign-user -- <supabase-auth-user-id>");
  process.exit(1);
}

async function main() {
  const [accounts, buyGroups, warehouses, orders] = await prisma.$transaction([
    prisma.amazonAccount.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.buyGroup.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.warehouse.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.order.updateMany({ where: { userId: null }, data: { userId } })
  ]);

  console.log(`Assigned unowned rows to Supabase user ${userId}`);
  console.log(`Amazon accounts: ${accounts.count}`);
  console.log(`Buy groups: ${buyGroups.count}`);
  console.log(`Warehouses: ${warehouses.count}`);
  console.log(`Orders: ${orders.count}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
