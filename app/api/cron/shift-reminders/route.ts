import { NextRequest } from "next/server";
import { sendTomorrowShiftReminders } from "@/lib/reminders";

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await sendTomorrowShiftReminders();
  return Response.json(result);
}
