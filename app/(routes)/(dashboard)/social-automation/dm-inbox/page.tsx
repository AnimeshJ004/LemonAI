import { Metadata } from "next";
import { DMInboxPanel } from "@/components/social/dm-inbox-panel";
import { MessageSquare, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Social DM Inbox | Lemon AI",
  description: "Unified inbox for Instagram and Facebook DMs with AI auto-reply. Capture leads from social conversations.",
};

export default function DMInboxPage() {
  return (
    <div className="py-6 px-4 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              Social DM Inbox
            </h1>
            <Badge className="text-[10px] bg-emerald-600 text-white gap-1">
              <span className="size-1.5 rounded-full bg-white animate-pulse" />
              Live
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Unified Instagram & Facebook DM inbox with AI-powered auto-reply and lead capture
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 text-xs">
          <Link href="/social-automation">
            <ArrowLeft className="size-3.5" /> Back to Social Automation
          </Link>
        </Button>
      </div>

      <DMInboxPanel />
    </div>
  );
}
