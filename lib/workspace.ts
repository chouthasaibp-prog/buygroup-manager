import type { Profile, Workspace, WorkspaceMember, WorkspaceRole, WorkspaceType } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/supabase/server";

export type WorkspaceMembership = WorkspaceMember & {
  workspace: Workspace;
};

export type WorkspaceContext = {
  profile: Profile;
  memberships: WorkspaceMembership[];
  activeMembership: WorkspaceMembership;
  activeWorkspace: Workspace;
  role: WorkspaceRole;
  isAdmin: boolean;
};

export function generateInviteCode() {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(2, 10).toUpperCase();
}

export async function ensureProfile() {
  const user = await requireUser();
  const email = user.email ?? `${user.id}@supabase.local`;
  const firstName = typeof user.user_metadata?.firstName === "string" ? user.user_metadata.firstName : null;
  const lastName = typeof user.user_metadata?.lastName === "string" ? user.user_metadata.lastName : null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const name = fullName || user.user_metadata?.name || user.user_metadata?.full_name || null;

  return prisma.profile.upsert({
    where: { authUserId: user.id },
    update: { email, ...(name ? { name } : {}), ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) },
    create: {
      authUserId: user.id,
      email,
      name,
      firstName,
      lastName
    }
  });
}

export function displayProfileName(profile: Pick<Profile, "firstName" | "lastName" | "name" | "email">) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return fullName || profile.name || profile.email;
}

export async function getWorkspaceMemberships(profileId: string) {
  return prisma.workspaceMember.findMany({
    where: {
      profileId,
      status: "ACTIVE"
    },
    include: { workspace: true },
    orderBy: [
      { role: "asc" },
      { joinedAt: "asc" },
      { createdAt: "asc" }
    ]
  });
}

export async function getWorkspaceContext(workspaceId?: string | null): Promise<WorkspaceContext> {
  const profile = await ensureProfile();
  const memberships = await getWorkspaceMemberships(profile.id);

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const activeMembership =
    (workspaceId ? memberships.find((membership) => membership.workspaceId === workspaceId) : null) ??
    memberships.find((membership) => membership.workspace.type === "PERSONAL") ??
    memberships[0];

  if (!activeMembership) {
    redirect("/onboarding");
  }

  const role = activeMembership.role;

  return {
    profile,
    memberships,
    activeMembership,
    activeWorkspace: activeMembership.workspace,
    role,
    isAdmin: role === "OWNER" || role === "ADMIN"
  };
}

export async function createWorkspaceForProfile(profile: Profile, type: WorkspaceType, name: string, role: WorkspaceRole = "OWNER") {
  let inviteCode = generateInviteCode();
  for (let tries = 0; tries < 5; tries += 1) {
    const existing = await prisma.workspace.findUnique({ where: { inviteCode } });
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  return prisma.workspace.create({
    data: {
      name,
      type,
      ownerProfileId: profile.id,
      inviteCode,
      members: {
        create: {
          profileId: profile.id,
          role,
          status: "ACTIVE",
          joinedAt: new Date()
        }
      }
    }
  });
}

export async function requireWorkspaceActionContext(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!workspaceId) throw new Error("Missing workspace.");
  return getWorkspaceContext(workspaceId);
}

export function orderVisibilityWhere(context: Pick<WorkspaceContext, "activeWorkspace" | "profile" | "isAdmin">) {
  return {
    workspaceId: context.activeWorkspace.id,
    ...(context.isAdmin ? {} : { submittedByProfileId: context.profile.id })
  };
}
