import { Metadata } from "next";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "CRM Activity Log | Lemon AI",
  description: "Complete audit trail of every customer touchpoint — calls, DMs, emails, stage changes, and appointments.",
};

export default function ActivitiesPage() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="size-6 text-primary" /> Activity Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every touchpoint across all leads — calls, DMs, chats, stage changes, and appointments.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 text-xs">
          <Link href="/crm/pipeline">
            View Pipeline <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <ActivityTimeline />
    </div>
  );
}
