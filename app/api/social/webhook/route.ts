import { handleMetaWebhookGet, handleMetaWebhookPost } from "@/lib/meta-webhook";

export const maxDuration = 60;

/**
 * Meta Webhook verification & ingestion endpoint for Instagram & Facebook comments.
 * Both /api/social/webhook and /api/webhooks/meta share this exact battle-tested handler.
 */
export const GET = handleMetaWebhookGet;
export const POST = handleMetaWebhookPost;
