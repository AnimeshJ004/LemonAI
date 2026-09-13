"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CRMConversation, CRMMessage, Lead } from "@/lib/crm-service";
import { ConversationList } from "@/components/crm/inbox/conversation-list";
import { ChatWindow } from "@/components/crm/inbox/chat-window";
import { ChatInput } from "@/components/crm/inbox/chat-input";
import { HumanTakeoverBanner } from "@/components/crm/inbox/human-takeover-banner";
import { NewConversationDialog } from "@/components/crm/inbox/new-conversation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateCalcomBookingUrl } from "@/lib/calcom-url";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  Building2,
  Calendar,
  ExternalLink,
  Sparkles,
  Bot,
  Copy,
  DollarSign,
  MessageSquare,
  RefreshCw,
  Plus,
} from "lucide-react";

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);

  // Fetch active conversations
  const { data: convsData, isLoading: isLoadingConvs, refetch: refetchConvs } = useQuery({
    queryKey: ["crm-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/crm/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
    refetchInterval: 5000, // Real-time polling fallback
  });

  const conversations: CRMConversation[] = convsData?.conversations || [];

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedConvId && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // Fetch detailed messages for selected conversation
  const { data: activeDetail, refetch: refetchActive } = useQuery({
    queryKey: ["crm-conversation-detail", selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return null;
      const res = await fetch(`/api/crm/conversations?id=${selectedConvId}`);
      if (!res.ok) throw new Error("Failed to load conversation detail");
      return res.json();
    },
    enabled: !!selectedConvId,
    refetchInterval: 3000,
  });

  const activeConv = activeDetail?.conversation || conversations.find((c) => c.id === selectedConvId);
  const messages: CRMMessage[] = activeDetail?.messages || activeConv?.messages || [];
  const activeLead: Lead | undefined = activeConv?.lead;

  // Toggle Human Takeover Mutation
  const toggleAIMutation = useMutation({
    mutationFn: async (nextState: boolean) => {
      if (!activeConv) return;
      const res = await fetch("/api/crm/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConv.id,
          is_ai_active: nextState,
        }),
      });
      if (!res.ok) throw new Error("Failed to toggle AI state");
      return res.json();
    },
    onSuccess: (data, nextState) => {
      toast.success(nextState ? "AI Autopilot resumed" : "Human takeover active: AI paused");
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversation-detail", selectedConvId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update AI state");
    },
  });

  // Send Human Agent Message Mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!activeConv) return;
      const res = await fetch("/api/crm/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConv.id,
          content,
          sender_type: "human_agent",
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversation-detail", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      refetchActive();
      refetchConvs();

      if (data?.dispatch?.warning) {
        toast.warning(data.dispatch.warning);
      } else if (data?.dispatch?.error) {
        toast.error(`Outbound dispatch error: ${data.dispatch.error}`);
      } else if (data?.dispatch?.dispatched) {
        toast.success(`Message delivered to ${data.dispatch.channel?.toUpperCase()}!`);
      } else {
        toast.success("Message sent");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  // AI Assistant Auto-Reply Mutation
  const aiReplyMutation = useMutation({
    mutationFn: async () => {
      if (!activeConv) return;
      const res = await fetch("/api/crm/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConv.id,
          action: "ai_reply",
        }),
      });
      if (!res.ok) throw new Error("Failed to generate AI reply");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversation-detail", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      refetchActive();
      refetchConvs();

      if (data?.dispatch?.warning) {
        toast.warning(data.dispatch.warning);
      } else if (data?.dispatch?.error) {
        toast.error(`AI reply dispatch error: ${data.dispatch.error}`);
      } else if (data?.dispatch?.dispatched) {
        toast.success(`AI replied & delivered to ${data.dispatch.channel?.toUpperCase()}!`);
      } else {
        toast.success("AI Sales Assistant replied!");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to generate AI reply");
    },
  });

  // Simulate Inbound Lead Message Mutation
  const simulateInboundMutation = useMutation({
    mutationFn: async () => {
      if (!activeConv) return;
      const sampleQueries = [
        "What are your setup costs and deliverables for our team?",
        "Can we schedule a 15-minute discovery walkthrough this week?",
        "Does Lemon AI support multiple brand workspaces?",
        "How quickly can our team get onboarded with the automated bots?",
      ];
      const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
      const res = await fetch("/api/crm/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConv.id,
          content: randomQuery,
          sender_type: "lead",
        }),
      });
      if (!res.ok) throw new Error("Failed to simulate inbound message");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inbound prospect message received!");
      queryClient.invalidateQueries({ queryKey: ["crm-conversation-detail", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      refetchActive();
      refetchConvs();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to simulate message");
    },
  });

  // Outbound Call Trigger
  const handleTriggerCall = async () => {
    if (!activeLead?.phone) {
      toast.error("Lead does not have a phone number");
      return;
    }
    setIsCalling(true);
    try {
      const res = await fetch("/api/voice/call-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: activeLead.id, phone: activeLead.phone, name: activeLead.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to trigger call");
      toast.success(data.message || "Voice calling agent dispatched!");
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch voice call");
    } finally {
      setIsCalling(false);
    }
  };

  const calLink = generateCalcomBookingUrl({
    leadName: activeLead?.name || undefined,
    email: activeLead?.email || undefined,
    phone: activeLead?.phone || undefined,
  });

  const bant = activeLead?.metadata?.bant;

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 overflow-hidden max-w-[1700px] w-full mx-auto space-y-2">
      {/* Top Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            Omnichannel CRM Inbox
            <Badge variant="outline" className="text-[10px] font-semibold uppercase">
              Unified Threads
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Live stream from Website Chatbot, WhatsApp Cloud API, and Voice qualification.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchConvs();
            refetchActive();
          }}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" />
          Sync
        </Button>
      </div>

      {/* 3-Column Main Workspace */}
      <div className="flex-1 min-h-0 flex border border-border/70 rounded-2xl overflow-hidden bg-card/50 backdrop-blur-xs shadow-xs">
        {/* Column 1: Conversations List */}
        <div className="w-64 sm:w-72 lg:w-80 shrink-0 h-full min-h-0 flex flex-col">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={(conv) => setSelectedConvId(conv.id)}
            onNewConversation={() => setIsNewConvOpen(true)}
          />
        </div>

        {/* Column 2: Active Chat Area */}
        <div className="flex-1 min-h-0 flex flex-col h-full border-r border-border/70 min-w-0 bg-background/50">
          {activeConv ? (
            <>
              {/* Chat Top Banner with Human Takeover */}
              <div className="p-2.5 sm:p-3 border-b border-border/70 bg-card/60 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <h3 className="font-bold text-sm text-foreground truncate">
                      {activeLead?.name || "Prospect Thread"}
                    </h3>
                    <Badge variant="outline" className="h-5 text-[10px] uppercase">
                      {activeConv.channel}
                    </Badge>
                  </div>
                  {activeLead?.score !== undefined && (
                    <Badge
                      className={
                        activeLead.score >= 8
                          ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                      }
                    >
                      BANT: {activeLead.score}/10
                    </Badge>
                  )}
                </div>

                <HumanTakeoverBanner
                  isAIActive={activeConv.is_ai_active}
                  onToggle={(next) => toggleAIMutation.mutate(next)}
                  disabled={toggleAIMutation.isPending}
                />
              </div>

              {/* Live Message Stream */}
              <ChatWindow messages={messages} leadName={activeLead?.name || undefined} />

              {/* Reply Box */}
              <ChatInput
                onSendMessage={(content) => sendMutation.mutate(content)}
                onAIReply={() => aiReplyMutation.mutate()}
                onSimulateInbound={() => simulateInboundMutation.mutate()}
                isSending={sendMutation.isPending}
                isAIGenerating={aiReplyMutation.isPending}
                calLink={calLink}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-xs space-y-2">
              <MessageSquare className="size-8 text-muted-foreground/50" />
              <p>Select a conversation from the left to view messages and interact.</p>
            </div>
          )}
        </div>

        {/* Column 3: Lead Intelligence Dossier */}
        <div className="w-72 lg:w-80 shrink-0 h-full min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-card/30 hidden lg:block scrollbar-thin">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Lead Dossier
            </h3>
            <Badge variant="secondary" className="text-[10px] capitalize">
              Stage: {activeLead?.stage?.replace("_", " ") || "New"}
            </Badge>
          </div>

          {activeLead ? (
            <div className="space-y-4 text-xs">
              {/* Contact Snapshot */}
              <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="font-semibold text-sm text-foreground">
                  {activeLead.name || "Anonymous Prospect"}
                </div>
                {activeLead.metadata?.company && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="size-3.5 shrink-0" />
                    <span>{activeLead.metadata.company}</span>
                  </div>
                )}
                {activeLead.email && (
                  <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{activeLead.email}</span>
                  </div>
                )}
                {activeLead.phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    <span>{activeLead.phone}</span>
                  </div>
                )}
              </div>

              {/* Deal Value */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50">
                <span className="text-muted-foreground font-medium">Deal Value:</span>
                <strong className="text-sm text-foreground flex items-center gap-0.5">
                  <DollarSign className="size-3.5 text-muted-foreground -mr-0.5" />
                  {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
                    Number(activeLead.deal_value) || 0
                  )}
                </strong>
              </div>

              {/* BANT Qualification Card */}
              <div className="p-3 rounded-xl border border-border/70 space-y-2.5 bg-card/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 text-primary">
                    <Sparkles className="size-3" />
                    BANT Score
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {activeLead.score}/10
                  </Badge>
                </div>

                {bant ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="p-1.5 rounded bg-muted/40 text-center">
                        <span className="text-[9px] text-muted-foreground block">BUDGET</span>
                        <strong>{bant.budgetScore}/10</strong>
                      </div>
                      <div className="p-1.5 rounded bg-muted/40 text-center">
                        <span className="text-[9px] text-muted-foreground block">AUTHORITY</span>
                        <strong>{bant.authorityScore}/10</strong>
                      </div>
                      <div className="p-1.5 rounded bg-muted/40 text-center">
                        <span className="text-[9px] text-muted-foreground block">NEED</span>
                        <strong>{bant.needScore}/10</strong>
                      </div>
                      <div className="p-1.5 rounded bg-muted/40 text-center">
                        <span className="text-[9px] text-muted-foreground block">TIMING</span>
                        <strong>{bant.timingScore}/10</strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {bant.summary}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Lead is pending automated transcript scoring.
                  </p>
                )}
              </div>

              {/* Action 1: Call Lead via Voice AI */}
              <Button
                type="button"
                size="sm"
                onClick={handleTriggerCall}
                disabled={isCalling || !activeLead.phone}
                className="w-full gap-2 text-xs font-semibold"
              >
                <Bot className="size-4" />
                {isCalling ? "Dispatching Call..." : "Call Lead via Voice AI"}
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-xs p-6">
              No lead linked to this conversation yet.
            </div>
          )}
        </div>
      </div>

      {/* Start New Conversation Modal */}
      <NewConversationDialog
        isOpen={isNewConvOpen}
        onClose={() => setIsNewConvOpen(false)}
        onCreated={(conv) => {
          setSelectedConvId(conv.id);
          queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
          refetchConvs();
          refetchActive();
        }}
      />
    </div>
  );
}
