import { NextRequest, NextResponse } from "next/server";
import { processQueueBatch } from "@/lib/whatsapp/queue";

// External trigger for the queue worker — this app has no long-running Node
// process to poll the queue itself (single Next.js dev/prod server, no
// separate worker process), so a scheduler calls this on an interval instead:
// Vercel Cron, a system cron `curl`, Windows Task Scheduler, etc. Every call
// is safe to run concurrently/overlapping (SKIP LOCKED in processQueueBatch),
// so a slightly-too-frequent schedule can never double-send.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");

  if (secret && provided !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await processQueueBatch(20);
  return NextResponse.json(result);
}
