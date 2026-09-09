import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Kanban,
  Inbox,
  DollarSign,
  TrendingUp,
  Phone,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle,
  CalendarClock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "CRM & Pipeline Hub | Lemon AI",
  description: "Unified Omnichannel CRM, Deal Pipeline, Autonomous Lead Qualification, and Customer Lifetime Value.",
};

const CRM_MODULES = [
  {
    title: "Leads & Deals Pipeline",
    href: "/crm/pipeline",
    icon: Kanban,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    badge: "Drag & Drop Kanban",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    description: "Manage deals across 7 qualification stages: New, Contacted, Qualified, Booked, Proposal, Closed Won & Closed Lost.",
    actionText: "Open Pipeline Kanban",
  },
  {
    title: "Unified Omnichannel Inbox",
    href: "/crm/inbox",
    icon: Inbox,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    badge: "Instagram, FB, WA & Web",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    description: "Consolidated real-time inbox for customer inquiries across Instagram DMs, Facebook Messenger, WhatsApp, and Website Live Chat with 1-click Human Takeover.",
    actionText: "Open Unified Inbox",
  },
  {
    title: "Calendar & Appointments",
    href: "/appointments",
    icon: CalendarClock,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    badge: "Cal.com & Calendly Sync",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    description: "Connect your calendar, set up booking links, and let AI automatically schedule qualified appointments with prospects 24/7.",
    actionText: "Manage Appointments",
  },
  {
    title: "Autonomous AI Calling Agent",
    href: "/ai-calling",
    icon: Phone,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    badge: "Vapi.ai Voice Engine",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    description: "AI voice agent calls qualified prospects within 2 minutes of inquiry, evaluates BANT score, and books appointments into your calendar automatically.",
    actionText: "Open Voice Agent",
  },
  {
    title: "Growth Analytics & Attribution",
    href: "/analytics",
    icon: TrendingUp,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    badge: "Full Journey Funnel",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    description: "Complete funnel attribution tracking: Social Reach → Inbound Chats → Qualified Leads → Cal.com Bookings → Closed Won Revenue.",
    actionText: "View Growth Funnel",
  },
  {
    title: "Activity Log & Touchpoints",
    href: "/crm/activities",
    icon: CheckCircle,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    badge: "Full Audit Trail",
    badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    description: "Complete chronological log of every lead touchpoint — voice calls, DMs, stage changes, WhatsApp messages, chatbot conversations, and manual notes.",
    actionText: "View Activity Log",
  },
];

export default function CRMHubPage() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 md:p-8 shadow-xs">
        <div className="max-w-2xl space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Users className="size-3.5" /> Autonomous Sales & Conversion Engine
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Unified CRM & Deal Center
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Track leads captured from social media and website bots, monitor multi-stage deal pipelines, and convert prospects via automated WhatsApp and AI voice follow-ups.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="sm" className="gap-2 font-semibold">
              <Link href="/crm/pipeline">
                <Kanban className="size-4" /> View Deal Pipeline
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/crm/inbox">
                <Inbox className="size-4" /> Open Inbound Inbox
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* CRM Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CRM_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Card
              key={mod.title}
              className={`flex flex-col justify-between hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border ${mod.border}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`size-10 rounded-xl ${mod.bg} flex items-center justify-center`}>
                    <Icon className={`size-5 ${mod.color}`} />
                  </div>
                  <Badge variant="outline" className={`text-[11px] font-semibold ${mod.badgeColor}`}>
                    {mod.badge}
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-foreground">{mod.title}</CardTitle>
                <CardDescription className="text-xs leading-relaxed mt-1">
                  {mod.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <Button asChild className="w-full justify-between gap-2 text-xs font-semibold h-9" variant="outline">
                  <Link href={mod.href}>
                    <span>{mod.actionText}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
