"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createWorkspaceForProfile, ensureProfile } from "@/lib/workspace";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createPersonalWorkspace() {
  const profile = await ensureProfile();
  const existing = await prisma.workspaceMember.findFirst({
    where: {
      profileId: profile.id,
      workspace: { type: "PERSONAL", ownerProfileId: profile.id }
    },
    include: { workspace: true }
  });

  if (existing) redirect(`/?workspace=${existing.workspaceId}`);

  const workspace = await createWorkspaceForProfile(profile, "PERSONAL", `${profile.name ?? "My"} Personal Orders`);
  redirect(`/?workspace=${workspace.id}`);
}

export async function createOperatorWorkspace(formData: FormData) {
  const profile = await ensureProfile();
  const name = value(formData, "workspaceName") || `${profile.name ?? "My"} Buy Group Ops`;
  const operatorCode = value(formData, "operatorCreationCode");
  if (!process.env.OPERATOR_CREATION_CODE || operatorCode !== process.env.OPERATOR_CREATION_CODE) {
    redirect("/onboarding?error=Invalid operator access code.");
  }
  const workspace = await createWorkspaceForProfile(profile, "OPERATOR", name);
  redirect(`/?workspace=${workspace.id}`);
}

export async function joinOperatorWorkspace(formData: FormData) {
  const profile = await ensureProfile();
  const rawInvite = value(formData, "inviteCode");
  const inviteCode = rawInvite.split("/").filter(Boolean).at(-1)?.toUpperCase() ?? rawInvite.toUpperCase();
  const workspace = await prisma.workspace.findUnique({ where: { inviteCode } });

  if (!workspace || workspace.type !== "OPERATOR") {
    redirect("/onboarding?error=Invite code not found.");
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_profileId: {
        workspaceId: workspace.id,
        profileId: profile.id
      }
    },
    update: {
      status: "ACTIVE",
      role: "MEMBER",
      joinedAt: new Date()
    },
    create: {
      workspaceId: workspace.id,
      profileId: profile.id,
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: new Date()
    }
  });

  redirect(`/?workspace=${workspace.id}`);
}
