import { NextResponse } from "next/server";
import { runReminderNotificationCron } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReminderNotificationCron();
  return NextResponse.json({ ok: true, ...result });
}
