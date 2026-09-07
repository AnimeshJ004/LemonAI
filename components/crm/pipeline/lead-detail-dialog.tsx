"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { generateCalcomBookingUrl } from "@/lib/calcom-url";

interface LeadDetailDialogProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
}

export function LeadDetailDialog({
  lead,
  isOpen,
  onClose,
  onUpdate,
}: LeadDetailDialogProps) {
  if (!lead) return null;

  const [stage, setStage] = useState<LeadStage>(lead.stage);
  const [dealValue, setDealValue] = useState<string>(String(lead.deal_value || 0));
  const [notes, setNotes] = useState<string>(lead.metadata?.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  const bant = lead.metadata?.bant;
  const callLogs: VoiceCallLog[] = lead.metadata?.callLogs || [];

  const calLink = generateCalcomBookingUrl({
    leadName: lead.name || undefined,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          stage,
          deal_value: Number(dealValue) || 0,
          metadata: {
            ...lead.metadata,
            notes,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update lead");

      toast.success("Lead details updated successfully");
      onUpdate(data.lead);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save lead");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerCall = async () => {
    if (!lead.phone) {
      toast.error("Lead does not have a phone number on file");
      return;
    }
    setIsCalling(true);
    try {
      const res = await fetch("/api/voice/call-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-bold">{lead.name || "Lead Details"}</DialogTitle>
              <Badge variant="outline" className="text-xs uppercase">
                {lead.source}
              </Badge>
            </div>
            <Badge
              className={
                lead.score >= 8
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : lead.score >= 5
                  ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                  : "bg-slate-500/15 text-slate-600"
              }
            >
              Score: {lead.score}/10
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Created on {new Date(lead.created_at).toLocaleDateString()} at{" "}
            {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Contact Details Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 text-xs">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <span className="truncate">{lead.email || "No email provided"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground shrink-0" />
              <span>{lead.phone || "No phone provided"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground shrink-0" />
              <span>{lead.metadata?.company || "Individual / Not specified"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground shrink-0" />
              <span>
                {lead.metadata?.bookingInfo?.scheduledAt
                  ? `Booked: ${new Date(lead.metadata.bookingInfo.scheduledAt).toLocaleDateString()}`
                  : "No meeting booked yet"}
              </span>
            </div>
          </div>

          {/* Pipeline Stage & Deal Value Editor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Pipeline Stage</Label>
              <Select value={stage} onValueChange={(val) => setStage(val as LeadStage)}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Lead</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
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
                className="text-xs"
                placeholder="10000"
              />
            </div>
          </div>

          {/* BANT Intelligence Card */}
          <div className="border border-border/70 rounded-xl p-4 space-y-3 bg-card">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                BANT Lead Intelligence
              </h4>
              <span className="text-[11px] text-muted-foreground">
                {bant?.evaluatedAt ? `Scored ${new Date(bant.evaluatedAt).toLocaleDateString()}` : "AI Baseline"}
              </span>
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
                <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
                  {bant.summary}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                BANT criteria automatically evaluates when conversations stream in via website bot, WhatsApp, or voice.
              </p>
            )}
          </div>

          {/* Voice AI Calling Action */}
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
              disabled={isCalling || !lead.phone}
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

          {/* Notes Area */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Internal Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add qualification observations or customer requirements..."
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
