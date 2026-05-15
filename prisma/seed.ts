import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const name of ["LAEB", "Electronic Buyers"]) {
    await prisma.buyGroup.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const warehouse of [
      { name: "LAEB", code: "LAEB" },
      { name: "Electronic Buyers", code: "EB" }
    ]) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: {},
      create: warehouse
    });
  }

  for (const name of [
    "Keerthana Personal",
    "Keerthana Business",
    "Sai Mudigonda",
    "Sai BP Personal",
    "Sai BP Business",
    "Bristle and Co Amazon"
  ]) {
    await prisma.amazonAccount.upsert({
      where: { name },
      update: {},
      create: { name }
    });
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
