import { handleMetaWebhookGet, handleMetaWebhookPost } from "@/lib/meta-webhook";

export const maxDuration = 60;

/**
 * Meta Webhook verification & ingestion endpoint.
 * Configured in Meta Developers Dashboard under Webhooks -> Instagram / Page.
 */
export const GET = handleMetaWebhookGet;
export const POST = handleMetaWebhookPost;
