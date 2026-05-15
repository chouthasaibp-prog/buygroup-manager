import { PrismaClient, type WorkspaceType } from "@prisma/client";

const prisma = new PrismaClient();
const authUserId = process.argv[2];
const workspaceName = process.argv[3];
const workspaceType = (process.argv[4] ?? "PERSONAL").toUpperCase() as WorkspaceType;

function inviteCode() {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(2, 10).toUpperCase();
}

if (!authUserId || !workspaceName) {
  console.error("Usage: npm run make-workspace-owner -- <authUserId> <workspaceName> [PERSONAL|OPERATOR]");
  process.exit(1);
}

async function main() {
  const profile = await prisma.profile.upsert({
    where: { authUserId },
    update: {},
    create: {
      authUserId,
      email: `${authUserId}@pending.local`,
      name: workspaceName
    }
  });

  let code = inviteCode();
  while (await prisma.workspace.findUnique({ where: { inviteCode: code } })) {
    code = inviteCode();
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      type: workspaceType,
      ownerProfileId: profile.id,
      inviteCode: code,
      members: {
        create: {
          profileId: profile.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date()
        }
      }
    }
  });

  const [accounts, buyGroups, warehouses, orders] = await prisma.$transaction([
    prisma.amazonAccount.updateMany({
      where: {
        workspaceId: null,
        OR: [{ userId: authUserId }, { userId: null }]
      },
      data: { userId: authUserId, workspaceId: workspace.id }
    }),
    prisma.buyGroup.updateMany({
      where: {
        workspaceId: null,
        OR: [{ userId: authUserId }, { userId: null }]
      },
      data: { userId: authUserId, workspaceId: workspace.id }
    }),
    prisma.warehouse.updateMany({
      where: {
        workspaceId: null,
        OR: [{ userId: authUserId }, { userId: null }]
      },
      data: { userId: authUserId, workspaceId: workspace.id }
    }),
    prisma.order.updateMany({
      where: {
        workspaceId: null,
        OR: [{ userId: authUserId }, { userId: null }]
      },
      data: {
        userId: authUserId,
        workspaceId: workspace.id,
        submittedByProfileId: profile.id,
        createdByProfileId: profile.id
      }
    })
  ]);

  console.log(`Created ${workspace.type} workspace "${workspace.name}"`);
  console.log(`Workspace id: ${workspace.id}`);
  console.log(`Invite code: ${workspace.inviteCode}`);
  console.log(`Owner profile id: ${profile.id}`);
  console.log(`Assigned accounts: ${accounts.count}`);
  console.log(`Assigned buy groups: ${buyGroups.count}`);
  console.log(`Assigned warehouses: ${warehouses.count}`);
  console.log(`Assigned orders: ${orders.count}`);
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
