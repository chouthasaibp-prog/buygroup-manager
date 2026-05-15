import { PrismaClient, type OrderStage } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();
const inputPath = process.argv[2] ?? "backups/sqlite-export.json";

type RawRecord = Record<string, unknown>;

type ExportData = {
  exportedAt: string;
  source: string;
  tables: {
    amazonAccounts: RawRecord[];
    buyGroups: RawRecord[];
    warehouses: RawRecord[];
    orders: RawRecord[];
  };
};

const data = JSON.parse(readFileSync(inputPath, "utf8")) as ExportData;

function stringValue(record: RawRecord, key: string) {
  return String(record[key] ?? "");
}

function nullableString(record: RawRecord, key: string) {
  const value = record[key];
  return value === null || value === undefined || value === "" ? null : String(value);
}

function nullableNumber(record: RawRecord, key: string) {
  const value = record[key];
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function booleanValue(record: RawRecord, key: string) {
  const value = record[key];
  return value === true || value === 1 || value === "1" || value === "true";
}

function dateValue(record: RawRecord, key: string) {
  const value = record[key];
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" ? new Date(value) : new Date(String(value));
}

async function main() {
  const accountIdMap = new Map<string, string>();
  const buyGroupIdMap = new Map<string, string>();
  const warehouseIdMap = new Map<string, string>();

  for (const account of data.tables.amazonAccounts) {
    const oldId = stringValue(account, "id");
    const name = stringValue(account, "name");
    const existing = await prisma.amazonAccount.findUnique({ where: { name } });
    const saved = existing
      ? await prisma.amazonAccount.update({
          where: { id: existing.id },
          data: {
            defaultCreditCardDueDays: nullableNumber(account, "defaultCreditCardDueDays"),
            createdAt: dateValue(account, "createdAt") ?? existing.createdAt
          }
        })
      : await prisma.amazonAccount.upsert({
          where: { id: oldId },
          update: {
            name,
            defaultCreditCardDueDays: nullableNumber(account, "defaultCreditCardDueDays"),
            createdAt: dateValue(account, "createdAt") ?? undefined
          },
          create: {
            id: oldId,
            name,
            defaultCreditCardDueDays: nullableNumber(account, "defaultCreditCardDueDays"),
            createdAt: dateValue(account, "createdAt") ?? undefined
          }
        });
    accountIdMap.set(oldId, saved.id);
  }

  for (const buyGroup of data.tables.buyGroups) {
    const oldId = stringValue(buyGroup, "id");
    const name = stringValue(buyGroup, "name");
    const existing = await prisma.buyGroup.findUnique({ where: { name } });
    const saved = existing
      ? await prisma.buyGroup.update({
          where: { id: existing.id },
          data: { createdAt: dateValue(buyGroup, "createdAt") ?? existing.createdAt }
        })
      : await prisma.buyGroup.upsert({
          where: { id: oldId },
          update: {
            name,
            createdAt: dateValue(buyGroup, "createdAt") ?? undefined
          },
          create: {
            id: oldId,
            name,
            createdAt: dateValue(buyGroup, "createdAt") ?? undefined
          }
        });
    buyGroupIdMap.set(oldId, saved.id);
  }

  for (const warehouse of data.tables.warehouses) {
    const oldId = stringValue(warehouse, "id");
    const name = stringValue(warehouse, "name");
    const code = stringValue(warehouse, "code");
    const existingByCode = await prisma.warehouse.findUnique({ where: { code } });
    const existingByName = existingByCode ?? (await prisma.warehouse.findUnique({ where: { name } }));
    const saved = existingByName
      ? await prisma.warehouse.update({
          where: { id: existingByName.id },
          data: {
            name,
            code,
            createdAt: dateValue(warehouse, "createdAt") ?? existingByName.createdAt
          }
        })
      : await prisma.warehouse.upsert({
          where: { id: oldId },
          update: {
            name,
            code,
            createdAt: dateValue(warehouse, "createdAt") ?? undefined
          },
          create: {
            id: oldId,
            name,
            code,
            createdAt: dateValue(warehouse, "createdAt") ?? undefined
          }
        });
    warehouseIdMap.set(oldId, saved.id);
  }

  for (const order of data.tables.orders) {
    const oldId = stringValue(order, "id");
    const amazonAccountId = nullableString(order, "amazonAccountId");
    const buyGroupId = nullableString(order, "buyGroupId");
    const warehouseId = nullableString(order, "warehouseId");
    const orderData = {
      itemName: stringValue(order, "itemName"),
      quantity: Number(order.quantity),
      retailPrice: Number(order.retailPrice),
      payoutPerUnit: Number(order.payoutPerUnit),
      chaseCashbackPercent: Number(order.chaseCashbackPercent ?? 0),
      youngAdultEligible: booleanValue(order, "youngAdultEligible"),
      sameTracking: booleanValue(order, "sameTracking"),
      shippingType: nullableString(order, "shippingType"),
      orderNumber: nullableString(order, "orderNumber"),
      trackingNumber: nullableString(order, "trackingNumber"),
      trackingSubmitted: booleanValue(order, "trackingSubmitted"),
      delivered: booleanValue(order, "delivered"),
      scanned: booleanValue(order, "scanned"),
      paidOut: booleanValue(order, "paidOut"),
      creditCardPaid: booleanValue(order, "creditCardPaid"),
      profitReceived: booleanValue(order, "profitReceived"),
      currentStage: stringValue(order, "currentStage") as OrderStage,
      notes: nullableString(order, "notes"),
      manualCreditCardDueDate: dateValue(order, "manualCreditCardDueDate"),
      payoutReminderSnoozedAt: dateValue(order, "payoutReminderSnoozedAt"),
      createdAt: dateValue(order, "createdAt") ?? undefined,
      trackingAddedAt: dateValue(order, "trackingAddedAt"),
      trackingSubmittedAt: dateValue(order, "trackingSubmittedAt"),
      deliveredAt: dateValue(order, "deliveredAt"),
      scannedAt: dateValue(order, "scannedAt"),
      paidOutAt: dateValue(order, "paidOutAt"),
      creditCardPaidAt: dateValue(order, "creditCardPaidAt"),
      profitReceivedAt: dateValue(order, "profitReceivedAt"),
      updatedAt: dateValue(order, "updatedAt") ?? new Date(),
      amazonAccountId: amazonAccountId ? accountIdMap.get(amazonAccountId) ?? amazonAccountId : null,
      buyGroupId: buyGroupId ? buyGroupIdMap.get(buyGroupId) ?? buyGroupId : null,
      warehouseId: warehouseId ? warehouseIdMap.get(warehouseId) ?? warehouseId : null
    };

    await prisma.order.upsert({
      where: { id: oldId },
      update: orderData,
      create: {
        id: oldId,
        ...orderData
      }
    });
  }

  console.log(`Imported ${data.tables.orders.length} orders from ${inputPath}`);
  console.log("Import completed with upserts only. No Supabase rows were deleted.");
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
