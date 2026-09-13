"use client";

import React, { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadStage, VoiceCallLog } from "@/lib/crm-service";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  Building2,
  Calendar,
  Sparkles,
  ExternalLink,
  Bot,
  CheckCircle2,
  Loader2,
  Trash2,
  Save,
  AlertTriangle,
  User,
  DollarSign,
  Flame,
} from "lucide-react";
import { generateCalcomBookingUrl } from "@/lib/calcom-url";

interface LeadDetailDialogProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
  onDelete?: (leadId: string) => void;
}

export function LeadDetailDialog({
  lead,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: LeadDetailDialogProps) {
  // Form fields
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [source, setSource] = useState<string>("website");
  const [stage, setStage] = useState<LeadStage>("new");
  const [dealValue, setDealValue] = useState<string>("0");
  const [score, setScore] = useState<string>("5");
  const [notes, setNotes] = useState<string>("");

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);

  // Sync local state when lead changes
  useEffect(() => {
    if (lead) {
      setName(lead.name || "");
      setEmail(lead.email || "");
      setPhone(lead.phone || "");
      setCompany(lead.metadata?.company || "");
      setSource(lead.source || "website");
      setStage(lead.stage || "new");
      setDealValue(String(lead.deal_value || 0));
      setScore(String(lead.score ?? 5));
      setNotes(lead.metadata?.notes || "");
      setShowDeleteConfirm(false);
    }
  }, [lead]);

  if (!lead) return null;

  const bant = lead.metadata?.bant;
  const callLogs: VoiceCallLog[] = lead.metadata?.callLogs || [];

  const handleRescore = async () => {
    setIsRescoring(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          triggerScoring: true,
          transcript: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to score lead");
      if (data.lead) {
        setScore(String(data.lead.score ?? 5));
        onUpdate(data.lead);
        toast.success(`Lead re-scored: ${data.lead.score}/10!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to re-score");
    } finally {
      setIsRescoring(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          name: name.trim() || lead.name,
          email: email.trim() || null,
          phone: phone.trim() || null,
          company: company.trim(),
          source,
          stage,
          score: Math.min(10, Math.max(1, Number(score) || 5)),
          deal_value: Number(dealValue) || 0,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update lead");

      // Log stage change activity if stage changed
      if (stage !== lead.stage) {
        fetch("/api/crm/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: lead.id,
            type: "stage_change",
            title: `Moved to ${stage.replace("_", " ")}`,
            description: `Stage changed from ${lead.stage.replace("_", " ")} → ${stage.replace("_", " ")}`,
          }),
        }).catch(() => {});
      }

      toast.success("Lead details updated successfully");
      onUpdate(data.lead);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save lead");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/crm/leads?id=${lead.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete lead");

      toast.success("Lead deleted successfully");
      if (onDelete) {
        onDelete(lead.id);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleTriggerCall = async () => {
    if (!phone && !lead.phone) {
      toast.error("Lead does not have a phone number on file");
      return;
    }
    const targetPhone = phone || lead.phone;
    setIsCalling(true);
    try {
      const res = await fetch("/api/voice/call-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, phone: targetPhone, name: name || lead.name }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to initiate call");

      toast.success(data.message || "Voice qualification call dispatched!");
      // Re-fetch lead
      const updatedRes = await fetch(`/api/crm/leads?search=${encodeURIComponent(lead.email || lead.name || "")}`);
      const leadData = await updatedRes.json();
      const refetched = leadData.leads?.find((l: Lead) => l.id === lead.id);
      if (refetched) onUpdate(refetched);
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger voice call");
    } finally {
      setIsCalling(false);
    }
  };

  const isScoreHigh = Number(score) >= 8;
  const isScoreMedium = Number(score) >= 5 && Number(score) < 8;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/40">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <User className="size-5 text-primary" />
                <span>Edit Prospect Details</span>
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {source}
              </Badge>
            </div>
            <Badge
              className={
                isScoreHigh
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : isScoreMedium
                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  : "bg-slate-500/15 text-slate-600"
              }
            >
              Score: {score}/10
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Created on {new Date(lead.created_at).toLocaleDateString()} at{" "}
            {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Section 1: Contact Information */}
          <div className="space-y-3 p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-primary" />
              Contact Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Mitchell"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Company / Business</Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Acme Innovations"
                    className="text-xs h-9 pl-8"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan@company.com"
                    className="text-xs h-9 pl-8"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className="text-xs h-9 pl-8"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Pipeline Deal & Stage */}
          <div className="space-y-3 p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-emerald-500" />
              Pipeline & Deal Attributes
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Pipeline Stage</Label>
                <Select value={stage} onValueChange={(val) => setStage(val as LeadStage)}>
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Lead</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified (BANT)</SelectItem>
                    <SelectItem value="booked">Appointment Booked</SelectItem>
                    <SelectItem value="proposal">Proposal Sent</SelectItem>
                    <SelectItem value="closed_won">Closed Won</SelectItem>
                    <SelectItem value="closed_lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Deal Value ($)</Label>
                <Input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="text-xs h-9"
                  placeholder="10000"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Channel Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website Live Chat</SelectItem>
                    <SelectItem value="instagram">Instagram Comment / DM</SelectItem>
                    <SelectItem value="facebook">Facebook Comment / Msg</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="voice">AI Voice Call</SelectItem>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <span>BANT Score (1-10)</span>
                  {isScoreHigh && <Flame className="size-3 text-red-500" />}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Appointment Calendar</Label>
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Calendar className="size-4 text-purple-500 shrink-0" />
                  <span className="truncate">
                    {lead.metadata?.bookingInfo?.scheduledAt
                      ? `Booked: ${new Date(lead.metadata.bookingInfo.scheduledAt).toLocaleDateString()}`
                      : "No appointment booked"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: BANT Intelligence Card */}
          <div className="border border-border/70 rounded-xl p-3.5 space-y-3 bg-card">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                BANT Lead Intelligence
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {bant?.evaluatedAt ? `Scored ${new Date(bant.evaluatedAt).toLocaleDateString()}` : "AI Baseline"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRescore}
                  disabled={isRescoring}
                  className="h-6 text-[11px] px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Sparkles className={`size-3 ${isRescoring ? "animate-spin" : ""}`} />
                  {isRescoring ? "Scoring..." : "Re-Score AI"}
                </Button>
              </div>
            </div>

            {bant ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-muted/30">
                    <span className="text-[10px] text-muted-foreground block font-bold">BUDGET</span>
                    <strong className="text-sm">{bant.budgetScore}/10</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <span className="text-[10px] text-muted-foreground block font-bold">AUTHORITY</span>
                    <strong className="text-sm">{bant.authorityScore}/10</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <span className="text-[10px] text-muted-foreground block font-bold">NEED</span>
                    <strong className="text-sm">{bant.needScore}/10</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <span className="text-[10px] text-muted-foreground block font-bold">TIMING</span>
                    <strong className="text-sm">{bant.timingScore}/10</strong>
                  </div>
                </div>
                {bant.summary && (
                  <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
                    {bant.summary}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                BANT criteria automatically evaluates when conversations stream in via website bot, WhatsApp, Instagram, Facebook, or voice.
              </p>
            )}
          </div>

          {/* Section 4: Voice AI Calling Action */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-gradient-to-r from-primary/5 via-card to-card">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                <Bot className="size-4 text-primary" />
                Autonomous Voice AI Caller
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dispatches an AI phone agent to qualify this prospect and offer discovery booking.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isCalling || (!phone && !lead.phone)}
              onClick={handleTriggerCall}
              className="gap-1.5 text-xs font-semibold"
            >
              {isCalling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="size-3.5" />
                  Call Lead
                </>
              )}
            </Button>
          </div>

          {/* Call Logs if any */}
          {callLogs.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-muted-foreground uppercase">Voice Call History</h5>
              <div className="space-y-1.5">
                {callLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-border/50 text-xs space-y-1 bg-muted/20"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold capitalize flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        Status: {log.status}
                      </span>
                      <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    {log.summary && <p className="text-muted-foreground">{log.summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Internal Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Internal Notes & Activity Log</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add qualification observations, meeting transcripts, or customer requirements..."
              rows={3}
              className="text-xs leading-relaxed"
            />
          </div>
        </div>

        {/* Dialog Footer with Delete & Save actions */}
        <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-border/40">
          <div>
            {!showDeleteConfirm ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting || isSaving}
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 w-full sm:w-auto"
              >
                <Trash2 className="size-3.5" />
                Delete Lead
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                <span className="text-[11px] font-semibold text-destructive">Confirm delete?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-7 text-[11px] px-2.5 font-semibold"
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="text-xs font-semibold gap-1.5 h-9 shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
