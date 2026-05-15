import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const name of ["LAEB", "Electronic Buyers"]) {
    const existing = await prisma.buyGroup.findFirst({ where: { name, userId: null } });
    if (!existing) await prisma.buyGroup.create({ data: { name } });
  }

  for (const warehouse of [
      { name: "LAEB", code: "LAEB" },
      { name: "Electronic Buyers", code: "EB" }
    ]) {
    const existing = await prisma.warehouse.findFirst({ where: { code: warehouse.code, userId: null } });
    if (!existing) await prisma.warehouse.create({ data: warehouse });
  }

  for (const name of [
    "Keerthana Personal",
    "Keerthana Business",
    "Sai Mudigonda",
    "Sai BP Personal",
    "Sai BP Business",
    "Bristle and Co Amazon"
  ]) {
    const existing = await prisma.amazonAccount.findFirst({ where: { name, userId: null } });
    if (!existing) await prisma.amazonAccount.create({ data: { name } });
  }
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
