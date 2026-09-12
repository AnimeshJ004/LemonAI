"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KanbanBoard } from "@/components/crm/pipeline/kanban-board";
import { LeadsTable } from "@/components/crm/leads-table";
import { AddLeadDialog } from "@/components/crm/add-lead-dialog";
import type { Lead, LeadStage } from "@/lib/crm-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Search,
  DollarSign,
  Users,
  Flame,
  CalendarCheck,
  RefreshCw,
  Filter,
  UserPlus,
  Kanban,
  Table as TableIcon,
} from "lucide-react";

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addStage, setAddStage] = useState<LeadStage>("new");

  // Fetch leads and stats
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["crm-leads", searchTerm, sourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      const res = await fetch(`/api/crm/leads?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load leads");
      return res.json();
    },
  });

  const rawLeads: Lead[] = data?.leads || [];
  const filteredLeads =
    sourceFilter === "all"
      ? rawLeads
      : rawLeads.filter((l) => l.source === sourceFilter);

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

  const [isSyncingLeads, setIsSyncingLeads] = useState(false);

  const handleSyncSocialLeads = async () => {
    setIsSyncingLeads(true);
    try {
      const res = await fetch("/api/social/sync-now", { method: "POST" });
      const resData = await res.json();
      if (res.ok && (resData.success || resData.repliedCount >= 0)) {
        toast.success(
          `Sync complete: Scanned ${resData.scannedPostsCount || 0} posts across Instagram & Facebook.`
        );
        refetch();
        queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      } else {
        toast.error(resData.error || "Could not sync social comments");
      }
    } catch {
      toast.error("Network error syncing social leads");
    } finally {
      setIsSyncingLeads(false);
    }
  };

  const handleOpenAddModal = (stageToSet: LeadStage = "new") => {
    setAddStage(stageToSet);
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pipeline & Omnichannel CRM
          </h1>
          <p className="text-sm text-muted-foreground">
            Visual kanban and table tracking deals captured from Instagram, Facebook, Website, WhatsApp & Voice AI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher: Kanban vs Table List */}
          <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border/60">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className={`h-8 px-2.5 text-xs font-semibold gap-1.5 ${
                viewMode === "kanban" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              <Kanban className="size-3.5" />
              <span>Kanban</span>
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={`h-8 px-2.5 text-xs font-semibold gap-1.5 ${
                viewMode === "table" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              <TableIcon className="size-3.5" />
              <span>Table List</span>
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncSocialLeads}
            disabled={isSyncingLeads || isRefetching}
            className="h-9 gap-1.5 text-xs text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
            title="Scan connected Instagram & Facebook accounts for newly posted comments with buyer intent"
          >
            <RefreshCw className={`size-3.5 ${isSyncingLeads ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">{isSyncingLeads ? "Scanning..." : "Sync Social Leads"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isSyncingLeads}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAddModal("new")}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            Add Prospect
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pipeline Value</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{formattedTotalValue}</div>
          <p className="text-[11px] text-muted-foreground">Across all stages</p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Leads</span>
            <Users className="size-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.totalLeads}</div>
          <p className="text-[11px] text-muted-foreground">Captured from all sources</p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Qualified (Score ≥ 7)</span>
            <Flame className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.qualifiedCount}</div>
          <p className="text-[11px] text-muted-foreground">Ready for voice calling</p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Closed Conversion</span>
            <CalendarCheck className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.conversionRate}%</div>
          <p className="text-[11px] text-muted-foreground">{stats.wonCount} won opportunities</p>
        </div>
      </div>

      {/* Main View: Kanban Board vs Table List View */}
      {viewMode === "table" ? (
        <LeadsTable
          leads={rawLeads}
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
      ) : (
        <div className="space-y-4">
          {/* Filters & Search Toolbar for Kanban */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search leads by name, email, company..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="size-3.5 text-muted-foreground hidden sm:inline-block" />
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-9 text-xs w-[170px]">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="website">Website Chat</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="meta_ads">Meta Ads</SelectItem>
                  <SelectItem value="voice">Voice Call</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Interactive Kanban Board */}
          <div className="pt-2">
            {isLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-[280px] h-[520px] rounded-xl bg-muted/30 animate-pulse border border-border/50"
                  />
                ))}
              </div>
            ) : (
              <KanbanBoard
                initialLeads={filteredLeads}
                onLeadsChange={() => queryClient.invalidateQueries({ queryKey: ["crm-leads"] })}
                onAddLead={handleOpenAddModal}
              />
            )}
          </div>
        </div>
      )}

      {/* Add Lead Dialog Modal */}
      <AddLeadDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        defaultStage={addStage}
        onLeadCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
          refetch();
        }}
      />
    </div>
  );
}
