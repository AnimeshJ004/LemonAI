import { NextRequest } from "next/server";
import { handleMetaWebhookGet, handleMetaWebhookPost } from "@/lib/meta-webhook";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

/**
 * Meta Webhook verification & ingestion endpoint.
 * Configured in Meta Developers Dashboard under Webhooks -> Instagram / Page.
 *
 * Rate limiting: Meta can burst-post many events per second during high
 * traffic, so the budget is generous — 300 events/min per source IP. The
 * shared Upstash-backed limiter (`lib/rate-limit.ts`) is used so the limit
 * survives cold starts across serverless instances.
 */
export const GET = handleMetaWebhookGet;

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, {
    limit: 300,
    windowMs: 60_000,
    namespace: "webhook:meta",
  });
  if (limited) return limited;
  return handleMetaWebhookPost(req);
}
