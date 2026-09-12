"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/crm/leads-table";
import { AddLeadDialog } from "@/components/crm/add-lead-dialog";
import type { Lead } from "@/lib/crm-service";
import {
  Users,
  Kanban,
  Inbox,
  DollarSign,
  TrendingUp,
  Phone,
  ArrowRight,
  Plus,
  Flame,
  CalendarCheck,
  RefreshCw,
  CalendarClock,
  CheckCircle,
} from "lucide-react";

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

export function CRMHubClient() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Fetch leads and stats
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const res = await fetch("/api/crm/leads");
      if (!res.ok) throw new Error("Failed to load leads");
      return res.json();
    },
  });

  const leads: Lead[] = data?.leads || [];
  const stats = data?.stats || {
    totalLeads: 0,
    totalPipelineValue: 0,
    qualifiedCount: 0,
    wonCount: 0,
    conversionRate: 0,
  };

  const formattedTotalValue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(stats.totalPipelineValue);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Users className="size-3.5" /> Autonomous Sales & Conversion Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Unified CRM & Deal Center
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manage leads captured across Instagram, Facebook, Website bots, and WhatsApp. Add new prospects, edit details, and track conversions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              onClick={() => setIsAddOpen(true)}
              size="sm"
              className="gap-2 font-semibold shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Add Prospect
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/crm/pipeline">
                <Kanban className="size-4" /> View Kanban Pipeline
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pipeline Value</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{formattedTotalValue}</div>
          <p className="text-[11px] text-muted-foreground">Across all stages</p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Leads</span>
            <Users className="size-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalLeads}</div>
          <p className="text-[11px] text-muted-foreground">Captured from all sources</p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Qualified (Score ≥ 7)</span>
            <Flame className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.qualifiedCount}</div>
          <p className="text-[11px] text-muted-foreground">Ready for sales outreach</p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Won Deals</span>
            <CalendarCheck className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.wonCount} won ({stats.conversionRate}%)</div>
          <p className="text-[11px] text-muted-foreground">Conversion rate</p>
        </div>
      </div>

      {/* Leads Table Management Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>All Prospects & Leads</span>
              <Badge variant="secondary" className="text-xs">
                {leads.length}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Add new leads manually, edit lead qualification details, or delete inactive prospects.
            </p>
          </div>

          <Button asChild variant="ghost" size="sm" className="text-xs text-primary gap-1 self-start sm:self-auto">
            <Link href="/crm/pipeline">
              <span>Open Full Kanban Board</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        <LeadsTable
          leads={leads}
          isLoading={isLoading}
          onRefresh={() => refetch()}
          onLeadUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
            refetch();
          }}
          onLeadDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
            refetch();
          }}
          onLeadAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
            refetch();
          }}
        />
      </div>

      {/* CRM Modules Grid */}
      <div className="space-y-4 pt-4 border-t border-border/60">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">CRM Automation Modules</h2>
          <p className="text-xs text-muted-foreground">
            Explore dedicated hubs for deal pipelines, omnichannel messaging, automated calling, and appointments.
          </p>
        </div>

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

      {/* Add Lead Dialog Modal */}
      <AddLeadDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onLeadCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
          refetch();
        }}
      />
    </div>
  );
}
