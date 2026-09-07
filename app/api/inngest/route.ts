import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { publishScheduledPost, publishScheduledPostsCron } from "@/inngest/functions/publish-scheduled-posts";
import { pollPostComments } from "@/inngest/functions/poll-post-comments";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    publishScheduledPostsCron,
    publishScheduledPost,
    pollPostComments,
  ],
});