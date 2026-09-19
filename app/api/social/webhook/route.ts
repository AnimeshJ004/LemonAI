import { NextRequest } from "next/server";
import { handleMetaWebhookGet, handleMetaWebhookPost } from "@/lib/meta-webhook";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

/**
 * Meta Webhook verification & ingestion endpoint for Instagram & Facebook comments.
 * Both /api/social/webhook and /api/webhooks/meta share this exact battle-tested handler.
 *
 * Rate limited to 300 events/min per source IP via the shared Upstash-backed
 * limiter (see `lib/rate-limit.ts`).
 */
export const GET = handleMetaWebhookGet;

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, {
    limit: 300,
    windowMs: 60_000,
    namespace: "webhook:social",
  });
  if (limited) return limited;
  return handleMetaWebhookPost(req);
}
