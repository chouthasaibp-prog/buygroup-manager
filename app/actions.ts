"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { deriveStage } from "@/lib/domain";

const boolFromForm = (formData: FormData, key: string) => formData.get(key) === "on" || formData.get(key) === "true";
const numberFromForm = (formData: FormData, key: string, fallback = 0) => Number(formData.get(key) || fallback);
const optionalString = (formData: FormData, key: string) => {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
};
const amazonOrderNumberPattern = /^\d{3}-\d{7}-\d{7}$/;
const optionalAmazonOrderNumber = (formData: FormData) => {
  const value = optionalString(formData, "orderNumber");
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const formatted = digits.length === 17 ? `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10, 17)}` : value;
  if (!amazonOrderNumberPattern.test(formatted)) {
    throw new Error("Order number must use the format 114-3361283-3021808.");
  }
  return formatted;
};
const optionalAmazonTrackingNumber = (formData: FormData) => {
  const value = optionalString(formData, "trackingNumber");
  if (!value) return null;
  return value.toUpperCase();
};
const destinationCodeFor = (name: string) => {
  if (name.toLowerCase() === "electronic buyers") return "EB";
  const compact = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return compact || "DEST";
};

async function destinationIdForBuyGroup(buyGroupId: string | null) {
  if (!buyGroupId) return null;
  const buyGroup = await prisma.buyGroup.findUnique({ where: { id: buyGroupId } });
  if (!buyGroup) return null;
  const code = destinationCodeFor(buyGroup.name);
  const existingByName = await prisma.warehouse.findUnique({ where: { name: buyGroup.name } });
  if (existingByName) return existingByName.id;

  const warehouse = await prisma.warehouse.upsert({
    where: { code },
    update: { name: buyGroup.name },
    create: { name: buyGroup.name, code }
  });
  return warehouse.id;
}

async function deriveStagePatch(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  await prisma.order.update({
    where: { id: orderId },
    data: { currentStage: deriveStage(order) }
  });
}

export async function createOrder(formData: FormData) {
  const chaseValue = String(formData.get("chaseCashbackPercent") ?? "0");
  const chaseCashbackPercent = chaseValue === "custom" ? numberFromForm(formData, "customChaseCashbackPercent") : Number(chaseValue);
  const buyGroupId = optionalString(formData, "buyGroupId");
  const destinationId = await destinationIdForBuyGroup(buyGroupId);
  const trackingNumber = optionalAmazonTrackingNumber(formData);

  const order = await prisma.order.create({
    data: {
      itemName: String(formData.get("itemName") ?? "").trim() || "Untitled order",
      quantity: Math.max(1, numberFromForm(formData, "quantity", 1)),
      retailPrice: numberFromForm(formData, "retailPrice"),
      payoutPerUnit: numberFromForm(formData, "payoutPerUnit"),
      chaseCashbackPercent,
      youngAdultEligible: boolFromForm(formData, "youngAdultEligible"),
      sameTracking: boolFromForm(formData, "sameTracking"),
      shippingType: optionalString(formData, "shippingType"),
      orderNumber: optionalAmazonOrderNumber(formData),
      trackingNumber,
      trackingAddedAt: trackingNumber ? new Date() : null,
      notes: optionalString(formData, "notes"),
      amazonAccountId: optionalString(formData, "amazonAccountId"),
      buyGroupId,
      warehouseId: destinationId
    }
  });

  await deriveStagePatch(order.id);
  revalidatePath("/");
}

export async function updateOrder(formData: FormData) {
  const id = String(formData.get("id"));
  const existing = await prisma.order.findUniqueOrThrow({ where: { id } });
  const trackingNumber = optionalAmazonTrackingNumber(formData);
  const trackingSubmitted = !!trackingNumber && boolFromForm(formData, "trackingSubmitted");
  const delivered = !!trackingNumber && boolFromForm(formData, "delivered");
  const scanned = delivered && boolFromForm(formData, "scanned");
  const paidOut = delivered && scanned && boolFromForm(formData, "paidOut");
  const creditCardPaid = paidOut && boolFromForm(formData, "creditCardPaid");
  const profitReceived = creditCardPaid && boolFromForm(formData, "profitReceived");
  const chaseValue = String(formData.get("chaseCashbackPercent") ?? existing.chaseCashbackPercent);
  const chaseCashbackPercent = chaseValue === "custom" ? numberFromForm(formData, "customChaseCashbackPercent") : Number(chaseValue);
  const buyGroupId = optionalString(formData, "buyGroupId");
  const destinationId = await destinationIdForBuyGroup(buyGroupId);

  await prisma.order.update({
    where: { id },
    data: {
      itemName: String(formData.get("itemName") ?? existing.itemName).trim() || existing.itemName,
      quantity: Math.max(1, numberFromForm(formData, "quantity", existing.quantity)),
      retailPrice: numberFromForm(formData, "retailPrice", existing.retailPrice),
      payoutPerUnit: numberFromForm(formData, "payoutPerUnit", existing.payoutPerUnit),
      chaseCashbackPercent,
      youngAdultEligible: boolFromForm(formData, "youngAdultEligible"),
      sameTracking: boolFromForm(formData, "sameTracking"),
      shippingType: optionalString(formData, "shippingType"),
      orderNumber: optionalAmazonOrderNumber(formData),
      trackingNumber,
      trackingSubmitted,
      delivered,
      scanned,
      paidOut,
      creditCardPaid,
      profitReceived,
      notes: optionalString(formData, "notes"),
      amazonAccountId: optionalString(formData, "amazonAccountId"),
      buyGroupId,
      warehouseId: destinationId,
      manualCreditCardDueDate: optionalString(formData, "manualCreditCardDueDate")
        ? new Date(String(formData.get("manualCreditCardDueDate")))
        : null,
      trackingAddedAt: trackingNumber && !existing.trackingNumber ? new Date() : existing.trackingAddedAt,
      trackingSubmittedAt: trackingSubmitted && !existing.trackingSubmitted ? new Date() : existing.trackingSubmittedAt,
      deliveredAt: delivered && !existing.delivered ? new Date() : existing.deliveredAt,
      scannedAt: scanned && !existing.scanned ? new Date() : existing.scannedAt,
      paidOutAt: paidOut && !existing.paidOut ? new Date() : existing.paidOutAt,
      creditCardPaidAt: creditCardPaid && !existing.creditCardPaid ? new Date() : existing.creditCardPaidAt,
      profitReceivedAt: profitReceived && !existing.profitReceived ? new Date() : existing.profitReceivedAt
    }
  });

  await deriveStagePatch(id);
  revalidatePath("/");
}

export async function addTracking(formData: FormData) {
  const id = String(formData.get("id"));
  const trackingNumber = optionalAmazonTrackingNumber(formData);
  const existing = await prisma.order.findUniqueOrThrow({ where: { id } });

  await prisma.order.update({
    where: { id },
    data: {
      trackingNumber,
      trackingAddedAt: trackingNumber && !existing.trackingNumber ? new Date() : existing.trackingAddedAt
    }
  });

  await deriveStagePatch(id);
  revalidatePath("/");
}

export async function quickAction(formData: FormData) {
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  const now = new Date();
  const data = {} as Record<string, unknown>;

  if (action === "submitTracking" && order.trackingNumber) {
    data.trackingSubmitted = true;
    data.trackingSubmittedAt = now;
  }

  if (action === "delivered") {
    data.delivered = true;
    data.deliveredAt = now;
  }

  if (action === "scanned" && order.delivered) {
    data.scanned = true;
    data.scannedAt = now;
  }

  if (action === "paidOut" && order.delivered && order.scanned) {
    data.paidOut = true;
    data.paidOutAt = now;
  }

  if (action === "cardPaid" && order.paidOut) {
    data.creditCardPaid = true;
    data.creditCardPaidAt = now;
  }

  if (action === "profitReceived" && order.creditCardPaid) {
    data.profitReceived = true;
    data.profitReceivedAt = now;
  }

  if (action === "snoozePayout") {
    const days = numberFromForm(formData, "days", 1);
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    data.payoutReminderSnoozedAt = snoozedUntil;
  }

  if (Object.keys(data).length > 0) {
    await prisma.order.update({ where: { id }, data });
    await deriveStagePatch(id);
  }

  revalidatePath("/");
}

export async function setAccountDefaultDueDays(formData: FormData) {
  await prisma.amazonAccount.update({
    where: { id: String(formData.get("id")) },
    data: { defaultCreditCardDueDays: numberFromForm(formData, "defaultCreditCardDueDays", 7) }
  });

  revalidatePath("/");
}

export async function createAmazonAccount(formData: FormData) {
  const name = optionalString(formData, "name");
  if (!name) return;

  await prisma.amazonAccount.upsert({
    where: { name },
    update: {},
    create: {
      name,
      defaultCreditCardDueDays: numberFromForm(formData, "defaultCreditCardDueDays", 7)
    }
  });

  revalidatePath("/");
}

export async function createBuyGroup(formData: FormData) {
  const name = optionalString(formData, "name");
  if (!name) return;

  await prisma.buyGroup.upsert({
    where: { name },
    update: {},
    create: { name }
  });
  const code = destinationCodeFor(name);
  await prisma.warehouse.upsert({
    where: { code },
    update: { name },
    create: { name, code }
  });

  revalidatePath("/");
}

export async function deleteOrder(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;

  await prisma.order.delete({ where: { id } });
  revalidatePath("/");
}

export async function setOrderBuyGroup(formData: FormData) {
  const id = String(formData.get("id"));
  const buyGroupId = optionalString(formData, "buyGroupId");
  if (!id || !buyGroupId) return;

  await prisma.order.update({
    where: { id },
    data: {
      buyGroupId,
      warehouseId: await destinationIdForBuyGroup(buyGroupId)
    }
  });

  revalidatePath("/");
}

export async function exportOrdersCsv() {
  // Placeholder seam for file-based exports. The UI currently exposes the v1 scope;
  // future work can stream a generated CSV from a route handler.
}
