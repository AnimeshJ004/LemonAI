import { Metadata } from "next";
import { DMInboxView } from "@/components/social/dm-inbox-view";

export const metadata: Metadata = {
  title: "Social DM Inbox | Lemon AI",
  description: "Unified inbox for Instagram and Facebook DMs with AI auto-reply. Capture leads from social conversations.",
};

export default function DMInboxPage() {
  return <DMInboxView />;
}
