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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { Lead, CRMConversation } from "@/lib/crm-service";
import { toast } from "sonner";
import { MessageSquarePlus, Loader2, Globe, MessageSquare, Phone } from "lucide-react";

interface NewConversationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conv: CRMConversation) => void;
}

export function NewConversationDialog({
  isOpen,
  onClose,
  onCreated,
}: NewConversationDialogProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>("custom");
  const [customName, setCustomName] = useState("");
  const [channel, setChannel] = useState("website");
  const [initialMessage, setInitialMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch leads for the select dropdown
  const { data: leadsData } = useQuery({
    queryKey: ["crm-leads-quick"],
    queryFn: async () => {
      const res = await fetch("/api/crm/leads");
      if (!res.ok) return { leads: [] };
      return res.json();
    },
    enabled: isOpen,
  });

  const leads: Lead[] = leadsData?.leads || [];

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();

    let leadIdToUse: string | null = null;
    if (selectedLeadId !== "custom" && selectedLeadId !== "none") {
      leadIdToUse = selectedLeadId;
    }

    setIsSubmitting(true);
    try {
      // If custom prospect name provided and no lead selected, optionally create lead or conversation
      let targetLeadId = leadIdToUse;
      if (!targetLeadId && customName.trim()) {
        try {
          const leadRes = await fetch("/api/crm/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: customName.trim(),
              source: channel,
              stage: "new",
              score: 7,
            }),
          });
          const leadData = await leadRes.json();
          if (leadData.lead?.id) {
            targetLeadId = leadData.lead.id;
          }
        } catch {}
      }

      const res = await fetch("/api/crm/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          lead_id: targetLeadId,
          content: initialMessage.trim() || undefined,
          sender_type: "human_agent",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create conversation");
      }

      toast.success("New conversation started!");
      if (data.conversation) {
        onCreated(data.conversation);
      }
      onClose();
      setCustomName("");
      setInitialMessage("");
      setSelectedLeadId("custom");
    } catch (err: any) {
      toast.error(err.message || "Could not start conversation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <MessageSquarePlus className="size-5 text-primary" />
            <span>Start New Omnichannel Thread</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleStartChat} className="space-y-3.5 pt-2">
          {/* Select Existing Lead */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Select Existing Lead or Enter Custom</Label>
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Choose a prospect..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="custom">✏️ Enter custom name / visitor</SelectItem>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name || "Anonymous"} {l.metadata?.company ? `(${l.metadata.company})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Name Input if custom is chosen */}
          {selectedLeadId === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Prospect / Visitor Name</Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="text-xs h-9"
                required
              />
            </div>
          )}

          {/* Channel Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">Website Live Chat</SelectItem>
                <SelectItem value="instagram">Instagram Direct</SelectItem>
                <SelectItem value="facebook">Facebook Messenger</SelectItem>
                <SelectItem value="whatsapp">WhatsApp Cloud API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Initial Message */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Initial Message (Optional)</Label>
            <Textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Type your opening message to start the conversation..."
              rows={3}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (selectedLeadId === "custom" && !customName.trim())}
              className="font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <MessageSquarePlus className="size-3.5" />
                  Start Conversation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
