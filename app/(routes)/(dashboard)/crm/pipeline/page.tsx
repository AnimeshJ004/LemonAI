"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KanbanBoard } from "@/components/crm/pipeline/kanban-board";
import type { Lead } from "@/lib/crm-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New Lead Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newDealValue, setNewDealValue] = useState("10000");
  const [newSource, setNewSource] = useState("website");
  const [newScore, setNewScore] = useState("7");

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

  // Create Lead Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          company: newCompany,
          deal_value: Number(newDealValue) || 0,
          source: newSource,
          score: Number(newScore) || 5,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to create lead");
      return resData.lead;
    },
    onSuccess: () => {
      toast.success("Lead created successfully!");
      setIsAddOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewCompany("");
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create lead");
    },
  });

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

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pipeline & Omnichannel CRM
          </h1>
          <p className="text-sm text-muted-foreground">
            Visual kanban tracking deals captured from Instagram, Facebook, Website, WhatsApp & Voice AI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncSocialLeads}
            disabled={isSyncingLeads || isRefetching}
            className="h-9 gap-1.5 text-xs text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
            title="Scan connected Instagram & Facebook accounts for newly posted comments with buyer intent"
          >
            <RefreshCw className={`size-3.5 ${isSyncingLeads ? "animate-spin" : ""}`} />
            {isSyncingLeads ? "Scanning..." : "Sync Social Leads"}
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
            onClick={() => setIsAddOpen(true)}
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

      {/* Filters & Search Toolbar */}
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
            <SelectTrigger className="h-9 text-xs w-[160px]">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="instagram">📱 Instagram</SelectItem>
              <SelectItem value="instagram_dm">📱 Instagram DM</SelectItem>
              <SelectItem value="facebook">📘 Facebook</SelectItem>
              <SelectItem value="facebook_dm">📘 Facebook DM</SelectItem>
              <SelectItem value="lead_form">📋 Lead Form</SelectItem>
              <SelectItem value="website">💬 Website Bot</SelectItem>
              <SelectItem value="whatsapp">💚 WhatsApp</SelectItem>
              <SelectItem value="meta_ads">🎯 Meta Ads</SelectItem>
              <SelectItem value="voice">📞 Voice Call</SelectItem>
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
          />
        )}
      </div>

      {/* Add Lead Dialog Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Add New Prospect</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Jordan Mitchell"
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jordan@company.com"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Company / Organization</Label>
              <Input
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Acme Innovations"
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Deal Value ($)</Label>
                <Input
                  type="number"
                  value={newDealValue}
                  onChange={(e) => setNewDealValue(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Source</Label>
                <Select value={newSource} onValueChange={setNewSource}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="voice">Voice Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Score (1-10)</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={newScore}
                  onChange={(e) => setNewScore(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={createMutation.isPending || (!newName && !newEmail && !newPhone)}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Adding..." : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
