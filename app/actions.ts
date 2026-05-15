"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { calculateFinancials, deriveStage } from "@/lib/domain";
import { createWorkspaceForProfile, ensureProfile, requireWorkspaceActionContext } from "@/lib/workspace";

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

async function requireWorkspaceAmazonAccountId(workspaceId: string, id: string | null) {
  if (!id) return null;
  const account = await prisma.amazonAccount.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!account) throw new Error("Amazon account not found.");
  return account.id;
}

async function requireWorkspaceBuyGroupId(workspaceId: string, id: string | null) {
  if (!id) return null;
  const buyGroup = await prisma.buyGroup.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!buyGroup) throw new Error("Buy group not found.");
  return buyGroup.id;
}

async function destinationIdForBuyGroup(workspaceId: string, buyGroupId: string | null) {
  if (!buyGroupId) return null;
  const buyGroup = await prisma.buyGroup.findFirst({ where: { id: buyGroupId, workspaceId } });
  if (!buyGroup) return null;
  const code = destinationCodeFor(buyGroup.name);
  const existingByName = await prisma.warehouse.findFirst({ where: { name: buyGroup.name, workspaceId } });
  if (existingByName) return existingByName.id;

  const warehouse = await prisma.warehouse.upsert({
    where: { workspaceId_code: { workspaceId, code } },
    update: { name: buyGroup.name },
    create: { workspaceId, name: buyGroup.name, code }
  });
  return warehouse.id;
}

async function deriveStagePatch(workspaceId: string, orderId: string) {
  const order = await prisma.order.findFirstOrThrow({ where: { id: orderId, workspaceId } });
  await prisma.order.update({
    where: { id: orderId },
    data: { currentStage: deriveStage(order) }
  });
}

export async function createOrder(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const chaseValue = String(formData.get("chaseCashbackPercent") ?? "0");
  const chaseCashbackPercent = chaseValue === "custom" ? numberFromForm(formData, "customChaseCashbackPercent") : Number(chaseValue);
  const buyGroupId = await requireWorkspaceBuyGroupId(workspaceId, optionalString(formData, "buyGroupId"));
  const destinationId = await destinationIdForBuyGroup(workspaceId, buyGroupId);
  const trackingNumber = optionalAmazonTrackingNumber(formData);
  const amazonAccountId = await requireWorkspaceAmazonAccountId(workspaceId, optionalString(formData, "amazonAccountId"));

  const order = await prisma.order.create({
    data: {
      userId: context.profile.authUserId,
      workspaceId,
      submittedByProfileId: context.profile.id,
      createdByProfileId: context.profile.id,
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
      amazonAccountId,
      buyGroupId,
      warehouseId: destinationId
    }
  });

  await deriveStagePatch(workspaceId, order.id);
  revalidatePath("/");
}

export async function updateOrder(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const id = String(formData.get("id"));
  const existing = await prisma.order.findFirstOrThrow({
    where: {
      id,
      workspaceId,
      ...(context.isAdmin ? {} : { submittedByProfileId: context.profile.id })
    }
  });
  const trackingNumber = optionalAmazonTrackingNumber(formData);
  const trackingSubmitted = !!trackingNumber && boolFromForm(formData, "trackingSubmitted");
  const delivered = !!trackingNumber && boolFromForm(formData, "delivered");
  const scanned = delivered && boolFromForm(formData, "scanned");
  const paidOut = delivered && scanned && boolFromForm(formData, "paidOut");
  const creditCardPaid = paidOut && boolFromForm(formData, "creditCardPaid");
  const profitReceived = creditCardPaid && boolFromForm(formData, "profitReceived");
  const chaseValue = String(formData.get("chaseCashbackPercent") ?? existing.chaseCashbackPercent);
  const chaseCashbackPercent = chaseValue === "custom" ? numberFromForm(formData, "customChaseCashbackPercent") : Number(chaseValue);
  const buyGroupId = await requireWorkspaceBuyGroupId(workspaceId, optionalString(formData, "buyGroupId"));
  const destinationId = await destinationIdForBuyGroup(workspaceId, buyGroupId);
  const amazonAccountId = await requireWorkspaceAmazonAccountId(workspaceId, optionalString(formData, "amazonAccountId"));
  const memberPayoutAmount = numberFromForm(formData, "memberPayoutAmount", existing.memberPayoutAmount ?? calculateFinancials(existing).amountOwed);

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
      ...(context.isAdmin ? {
        trackingSubmitted,
        delivered,
        scanned,
        paidOut,
        creditCardPaid,
        profitReceived,
        memberPaid: boolFromForm(formData, "memberPaid"),
        memberPaidAt: boolFromForm(formData, "memberPaid") && !existing.memberPaid ? new Date() : existing.memberPaidAt,
        memberPayoutAmount,
        internalAdminNotes: optionalString(formData, "internalAdminNotes")
      } : {}),
      notes: optionalString(formData, "notes"),
      memberVisibleNotes: optionalString(formData, "memberVisibleNotes"),
      amazonAccountId,
      buyGroupId,
      warehouseId: destinationId,
      manualCreditCardDueDate: optionalString(formData, "manualCreditCardDueDate")
        ? new Date(String(formData.get("manualCreditCardDueDate")))
        : null,
      trackingAddedAt: trackingNumber && !existing.trackingNumber ? new Date() : existing.trackingAddedAt,
      ...(context.isAdmin ? {
        trackingSubmittedAt: trackingSubmitted && !existing.trackingSubmitted ? new Date() : existing.trackingSubmittedAt,
        deliveredAt: delivered && !existing.delivered ? new Date() : existing.deliveredAt,
        scannedAt: scanned && !existing.scanned ? new Date() : existing.scannedAt,
        paidOutAt: paidOut && !existing.paidOut ? new Date() : existing.paidOutAt,
        creditCardPaidAt: creditCardPaid && !existing.creditCardPaid ? new Date() : existing.creditCardPaidAt,
        profitReceivedAt: profitReceived && !existing.profitReceived ? new Date() : existing.profitReceivedAt
      } : {})
    }
  });

  await deriveStagePatch(workspaceId, id);
  revalidatePath("/");
}

export async function addTracking(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const id = String(formData.get("id"));
  const trackingNumber = optionalAmazonTrackingNumber(formData);
  const existing = await prisma.order.findFirstOrThrow({
    where: {
      id,
      workspaceId,
      ...(context.isAdmin ? {} : { submittedByProfileId: context.profile.id })
    }
  });

  await prisma.order.update({
    where: { id },
    data: {
      trackingNumber,
      trackingAddedAt: trackingNumber && !existing.trackingNumber ? new Date() : existing.trackingAddedAt
    }
  });

  await deriveStagePatch(workspaceId, id);
  revalidatePath("/");
}

export async function quickAction(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const order = await prisma.order.findFirstOrThrow({
    where: {
      id,
      workspaceId,
      ...(context.isAdmin ? {} : { submittedByProfileId: context.profile.id })
    }
  });
  const now = new Date();
  const data = {} as Record<string, unknown>;

  const adminOnly = ["submitTracking", "delivered", "scanned", "paidOut", "cardPaid", "profitReceived", "snoozePayout", "memberPaid"];
  if (adminOnly.includes(action) && !context.isAdmin) {
    throw new Error("You do not have permission for this action.");
  }

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

  if (action === "memberPaid") {
    data.memberPaid = true;
    data.memberPaidAt = now;
    data.memberPayoutAmount = order.memberPayoutAmount ?? calculateFinancials(order).amountOwed;
  }

  if (action === "snoozePayout") {
    const days = numberFromForm(formData, "days", 1);
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    data.payoutReminderSnoozedAt = snoozedUntil;
  }

  if (Object.keys(data).length > 0) {
    await prisma.order.update({ where: { id }, data });
    await deriveStagePatch(workspaceId, id);
  }

  revalidatePath("/");
}

export async function setAccountDefaultDueDays(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const id = String(formData.get("id"));
  await prisma.amazonAccount.findFirstOrThrow({ where: { id, workspaceId }, select: { id: true } });
  await prisma.amazonAccount.update({
    where: { id },
    data: { defaultCreditCardDueDays: numberFromForm(formData, "defaultCreditCardDueDays", 7) }
  });

  revalidatePath("/");
}

export async function createAmazonAccount(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const name = optionalString(formData, "name");
  if (!name) return;

  await prisma.amazonAccount.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: {},
    create: {
      userId: context.profile.authUserId,
      workspaceId,
      name,
      defaultCreditCardDueDays: numberFromForm(formData, "defaultCreditCardDueDays", 7)
    }
  });

  revalidatePath("/");
}

export async function createBuyGroup(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const name = optionalString(formData, "name");
  if (!name) return;

  await prisma.buyGroup.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: {},
    create: { userId: context.profile.authUserId, workspaceId, name }
  });
  const code = destinationCodeFor(name);
  await prisma.warehouse.upsert({
    where: { workspaceId_code: { workspaceId, code } },
    update: { name },
    create: { userId: context.profile.authUserId, workspaceId, name, code }
  });

  revalidatePath("/");
}

export async function deleteOrder(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const id = String(formData.get("id"));
  if (!id) return;

  await prisma.order.findFirstOrThrow({
    where: {
      id,
      workspaceId,
      ...(context.isAdmin ? {} : { submittedByProfileId: context.profile.id })
    },
    select: { id: true }
  });
  await prisma.order.delete({ where: { id } });
  revalidatePath("/");
}

export async function setOrderBuyGroup(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  const workspaceId = context.activeWorkspace.id;
  const id = String(formData.get("id"));
  const buyGroupId = await requireWorkspaceBuyGroupId(workspaceId, optionalString(formData, "buyGroupId"));
  if (!id || !buyGroupId) return;
  await prisma.order.findFirstOrThrow({
    where: {
      id,
      workspaceId,
      ...(context.isAdmin ? {} : { submittedByProfileId: context.profile.id })
    },
    select: { id: true }
  });

  await prisma.order.update({
    where: { id },
    data: {
      buyGroupId,
      warehouseId: await destinationIdForBuyGroup(workspaceId, buyGroupId)
    }
  });

  revalidatePath("/");
}

export async function updateWorkspaceMemberStatus(formData: FormData) {
  const context = await requireWorkspaceActionContext(formData);
  if (!context.isAdmin) throw new Error("Only workspace admins can manage members.");

  const memberId = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!memberId || !["ACTIVE", "SUSPENDED"].includes(status)) return;

  const member = await prisma.workspaceMember.findFirstOrThrow({
    where: {
      id: memberId,
      workspaceId: context.activeWorkspace.id
    }
  });

  if (member.role === "OWNER" && member.profileId === context.profile.id) {
    throw new Error("Owners cannot suspend themselves.");
  }

  await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { status: status as "ACTIVE" | "SUSPENDED" }
  });

  revalidatePath("/");
}

export async function updateProfile(formData: FormData) {
  const profile = await ensureProfile();
  const firstName = optionalString(formData, "firstName");
  const lastName = optionalString(formData, "lastName");
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      firstName,
      lastName,
      name: fullName || profile.email
    }
  });

  revalidatePath("/");
}

export async function createPersonalWorkspaceFromApp() {
  const profile = await ensureProfile();
  const existing = await prisma.workspaceMember.findFirst({
    where: {
      profileId: profile.id,
      workspace: { type: "PERSONAL", ownerProfileId: profile.id }
    }
  });
  if (!existing) {
    await createWorkspaceForProfile(profile, "PERSONAL", `${profile.firstName || profile.name || "My"} Personal`);
  }
  revalidatePath("/");
}

export async function createOperatorWorkspaceFromApp(formData: FormData) {
  const profile = await ensureProfile();
  const name = optionalString(formData, "workspaceName") || `${profile.firstName || profile.name || "My"} Buy Group Ops`;
  await createWorkspaceForProfile(profile, "OPERATOR", name);
  revalidatePath("/");
}

export async function joinOperatorWorkspaceFromApp(formData: FormData) {
  const profile = await ensureProfile();
  const rawInvite = optionalString(formData, "inviteCode") ?? "";
  const inviteCode = rawInvite.split("/").filter(Boolean).at(-1)?.toUpperCase() ?? rawInvite.toUpperCase();
  const workspace = await prisma.workspace.findUnique({ where: { inviteCode } });
  if (!workspace || workspace.type !== "OPERATOR") throw new Error("Invite code not found.");

  await prisma.workspaceMember.upsert({
    where: { workspaceId_profileId: { workspaceId: workspace.id, profileId: profile.id } },
    update: { role: "MEMBER", status: "ACTIVE", joinedAt: new Date() },
    create: {
      workspaceId: workspace.id,
      profileId: profile.id,
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: new Date()
    }
  });

  revalidatePath("/");
}

export async function exportOrdersCsv() {
  // Placeholder seam for file-based exports. The UI currently exposes the v1 scope;
  // future work can stream a generated CSV from a route handler.
}
