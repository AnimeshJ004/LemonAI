import { Metadata } from "next";
import { ActivitiesView } from "@/components/crm/activities-view";

export const metadata: Metadata = {
  title: "CRM Activity Log | Lemon AI",
  description: "Complete audit trail of every customer touchpoint — calls, DMs, emails, stage changes, and appointments.",
};

export default function ActivitiesPage() {
  return <ActivitiesView />;
}
