import { Metadata } from "next";
import { CRMHubClient } from "@/components/crm/crm-hub-client";

export const metadata: Metadata = {
  title: "CRM & Leads Hub | Lemon AI",
  description: "Unified Omnichannel CRM, Deal Pipeline, Autonomous Lead Qualification, and Customer Lifetime Value.",
};

export default function CRMHubPage() {
  return <CRMHubClient />;
}
