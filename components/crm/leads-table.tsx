"use client";

import React, { useState } from "react";
import type { Lead, LeadStage } from "@/lib/crm-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LeadDetailDialog } from "@/components/crm/pipeline/lead-detail-dialog";
import { AddLeadDialog } from "@/components/crm/add-lead-dialog";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Sparkles,
  Globe,
  MessageSquare,
  Flame,
  RefreshCw,
  Filter,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_CONFIG: Record<LeadStage, { label: string; color: string; badge: string }> = {
  new: { label: "New Lead", color: "text-slate-500", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  contacted: { label: "Contacted", color: "text-blue-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
  qualified: { label: "Qualified", color: "text-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  booked: { label: "Booked", color: "text-purple-500", badge: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400" },
  proposal: { label: "Proposal", color: "text-indigo-500", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400" },
  closed_won: { label: "Closed Won", color: "text-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  closed_lost: { label: "Closed Lost", color: "text-rose-500", badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" },
};

interface LeadsTableProps {
  leads: Lead[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onLeadUpdated?: (lead: Lead) => void;
  onLeadDeleted?: (leadId: string) => void;
  onLeadAdded?: (lead: Lead) => void;
}

export function LeadsTable({
  leads,
  isLoading = false,
  onRefresh,
  onLeadUpdated,
  onLeadDeleted,
  onLeadAdded,
}: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calling state
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);

  // Filtered leads
  const filtered = leads.filter((l) => {
    if (stageFilter !== "all" && l.stage !== stageFilter) return false;
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = l.name?.toLowerCase().includes(q);
      const matchEmail = l.email?.toLowerCase().includes(q);
      const matchPhone = l.phone?.toLowerCase().includes(q);
      const matchCompany = l.metadata?.company?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchCompany) return false;
    }
    return true;
  });

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditOpen(true);
  };

  const confirmDelete = async () => {
    if (!leadToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/crm/leads?id=${leadToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete lead");

      toast.success(`Prospect "${leadToDelete.name || "Lead"}" deleted successfully`);
      if (onLeadDeleted) onLeadDeleted(leadToDelete.id);
      setLeadToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTriggerCall = async (lead: Lead) => {
    if (!lead.phone) {
      toast.error("Lead does not have a phone number on file");
      return;
    }
    setCallingLeadId(lead.id);
    try {
      const res = await fetch("/api/voice/call-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.phone,
          name: lead.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Call failed");
      toast.success(data.message || "Voice qualification call dispatched!");
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate AI call");
    } finally {
      setCallingLeadId(null);
    }
  };

  const handleStageChange = async (lead: Lead, newStage: LeadStage) => {
    if (lead.stage === newStage) return;
    try {
      const res = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, stage: newStage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change stage");
      toast.success(`Stage updated to ${newStage.replace("_", " ")}`);
      if (onLeadUpdated && data.lead) onLeadUpdated(data.lead);
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "instagram":
        return <span className="size-2 rounded-full bg-pink-500 inline-block" />;
      case "facebook":
        return <span className="size-2 rounded-full bg-blue-600 inline-block" />;
      case "whatsapp":
        return <MessageSquare className="size-3 text-emerald-500" />;
      case "voice":
        return <Phone className="size-3 text-amber-500" />;
      default:
        return <Globe className="size-3 text-sky-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, company..."
              className="pl-8 h-9 text-xs"
            />
          </div>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-9 text-xs w-[140px]">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="new">New Lead</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="closed_won">Closed Won</SelectItem>
              <SelectItem value="closed_lost">Closed Lost</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9 text-xs w-[130px]">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="voice">Voice Call</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-9 text-xs gap-1.5"
              title="Refresh lead list"
            >
              <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-9 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Plus className="size-4" />
            <span>Add Prospect</span>
          </Button>
        </div>
      </div>

      {/* Leads Table Container */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Prospect & Company</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Pipeline Stage</th>
                <th className="py-3 px-4">Deal Value</th>
                <th className="py-3 px-4">AI Score</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="py-4 px-4">
                      <div className="h-5 bg-muted/40 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                        <UserPlus className="size-5" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No leads found</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {search || stageFilter !== "all" || sourceFilter !== "all"
                          ? "Try adjusting your search query or channel/stage filters."
                          : "No prospects captured yet. Click '+ Add Prospect' to add your first lead manually or sync leads from connected social channels."}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddOpen(true)}
                        className="mt-2 text-xs gap-1.5 font-semibold"
                      >
                        <Plus className="size-3.5" /> Add Prospect Now
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const stageInfo = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.new;
                  const dealVal = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(Number(lead.deal_value) || 0);

                  const score = lead.score ?? 5;
                  const isHot = score >= 8;

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => handleEdit(lead)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      {/* Name & Company */}
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                            {lead.name || "Anonymous Prospect"}
                          </span>
                          {lead.metadata?.company ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="size-3 shrink-0" />
                              {lead.metadata.company}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Contact: Email & Phone */}
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div className="space-y-0.5">
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Mail className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[180px]">{lead.email}</span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Phone className="size-3 text-muted-foreground shrink-0" />
                              <span>{lead.phone}</span>
                            </div>
                          )}
                          {!lead.email && !lead.phone && (
                            <span className="text-[11px] italic text-muted-foreground/60">No contact info</span>
                          )}
                        </div>
                      </td>

                      {/* Pipeline Stage */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.stage}
                          onValueChange={(val) => handleStageChange(lead, val as LeadStage)}
                        >
                          <SelectTrigger className="h-7 text-[11px] px-2 w-[130px] border-none bg-muted/40 font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New Lead</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="booked">Booked</SelectItem>
                            <SelectItem value="proposal">Proposal</SelectItem>
                            <SelectItem value="closed_won">Closed Won</SelectItem>
                            <SelectItem value="closed_lost">Closed Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Deal Value */}
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-0.5">
                          <DollarSign className="size-3 text-muted-foreground -mr-0.5" />
                          <span>{dealVal}</span>
                        </div>
                      </td>

                      {/* AI Score */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold border",
                              isHot
                                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                : score >= 5
                                ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                                : "bg-slate-500/15 text-slate-600 border-slate-500/30"
                            )}
                          >
                            <Sparkles className="size-2.5" />
                            {score}/10
                          </span>
                          {isHot && (
                            <Badge className="h-4 px-1 text-[9px] bg-red-500/15 text-red-600 border-red-500/30 font-semibold gap-0.5">
                              <Flame className="size-2.5" /> Hot
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] font-medium capitalize gap-1 bg-muted/30"
                        >
                          {getSourceIcon(lead.source)}
                          <span>{lead.source.replace("_", " ")}</span>
                        </Badge>
                      </td>

                      {/* Actions: Edit & Delete Buttons */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* AI Voice Call Button */}
                          {lead.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleTriggerCall(lead)}
                              disabled={callingLeadId === lead.id}
                              className="size-7 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                              title="Call Lead with AI Voice Agent"
                            >
                              <Phone className={cn("size-3.5", callingLeadId === lead.id && "animate-spin")} />
                            </Button>
                          )}

                          {/* EDIT BUTTON */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(lead)}
                            className="h-7 px-2 text-xs font-semibold gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                            title="Edit Prospect Details"
                          >
                            <Edit2 className="size-3" />
                            <span>Edit</span>
                          </Button>

                          {/* DELETE BUTTON */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLeadToDelete(lead)}
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete Prospect"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD LEAD MODAL */}
      <AddLeadDialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onLeadCreated={(newLead) => {
          if (onLeadAdded) onLeadAdded(newLead);
        }}
      />

      {/* EDIT LEAD MODAL */}
      <LeadDetailDialog
        lead={selectedLead}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onUpdate={(updated) => {
          if (onLeadUpdated) onLeadUpdated(updated);
        }}
        onDelete={(id) => {
          if (onLeadDeleted) onLeadDeleted(id);
          setIsEditOpen(false);
        }}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <AlertDialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Lead &quot;{leadToDelete?.name || "Prospect"}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this prospect from your CRM? This action will permanently remove the lead record and all associated activities, and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setLeadToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold gap-1.5"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
