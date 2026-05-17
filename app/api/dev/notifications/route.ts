import { NextResponse } from "next/server";
import { sendTestNotification } from "@/lib/notifications";
import { getWorkspaceContext } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { workspaceId, channel } = await request.json().catch(() => ({}) as { workspaceId?: string; channel?: string });
  const context = await getWorkspaceContext(workspaceId);

  if (process.env.NODE_ENV !== "development" && !context.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (channel !== "email" && channel !== "slack") {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  await sendTestNotification(context.profile.id, context.activeWorkspace.id, channel);
  return NextResponse.json({ ok: true });
}
