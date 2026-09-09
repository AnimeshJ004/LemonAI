import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { publishScheduledPost, publishScheduledPostsCron } from "@/inngest/functions/publish-scheduled-posts";
import { pollPostComments } from "@/inngest/functions/poll-post-comments";
import { leadFollowupOrchestrator } from "@/inngest/functions/lead-followup-orchestrator";
import { adOptimizerCron } from "@/inngest/functions/ad-optimizer-cron";
import { pollSocialDMs } from "@/inngest/functions/poll-social-dms";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    publishScheduledPostsCron,
    publishScheduledPost,
    pollPostComments,
    leadFollowupOrchestrator,
    adOptimizerCron,
    pollSocialDMs,
  ],
});