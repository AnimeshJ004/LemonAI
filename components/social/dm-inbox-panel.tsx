"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  RefreshCw,
  Sparkles,
  Send,
  Bot,
  CheckCheck,
  User,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DM {
  id: string;
  platform: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  last_message: string;
  last_message_at: string;
  last_reply?: string;
  last_replied_at?: string;
  is_read: boolean;
  messages_count: number;
  raw_messages?: any[];
}

export function DMInboxPanel() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<DM | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["social-dms"],
    queryFn: async () => {
      const res = await fetch("/api/social/dms?limit=100");
      if (!res.ok) throw new Error("Failed to load DMs");
      return res.json();
    },
  });

  const syncMutation = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/social/dms", { method: "POST" });
      const d = await res.json();

      if (!res.ok) {
        toast.error(d.error || "Sync failed. Please try again.");
        return;
      }

      if (d.synced > 0) {
        toast.success(d.message || `Synced ${d.synced} DM conversation(s)!`);
      } else if (d.message?.includes("No Instagram or Facebook")) {
        toast.error("No Instagram/Facebook account connected.", {
          description: "Go to Settings → Channels to connect your Meta account first.",
          action: {
            label: "Open Settings",
            onClick: () => (window.location.href = "/settings"),
          },
          duration: 8000,
        });
      } else {
        toast.info(d.message || "No new DMs found. Your inbox is up to date.");
      }

      queryClient.invalidateQueries({ queryKey: ["social-dms"] });
    } catch {
      toast.error("Failed to sync DMs. Check your internet connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const replyMutation = useMutation({
    mutationFn: async ({ aiGenerate }: { aiGenerate: boolean }) => {
      if (!selected) throw new Error("No conversation selected");
      const res = await fetch("/api/social/dms/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selected.conversation_id,
          platform: selected.platform,
          recipientId: selected.sender_id,
          message: aiGenerate ? undefined : replyText,
          aiGenerate,
          context: selected.last_message,
        }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Reply sent!");
      setReplyText(data.replyText || "");
      queryClient.invalidateQueries({ queryKey: ["social-dms"] });
    },
    onError: (err: any) => toast.error(err.message || "Reply failed"),
  });

  const dms: DM[] = (data?.dms || []).filter((d: DM) =>
    !searchTerm || d.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.last_message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const PlatformIcon = ({ platform }: { platform: string }) => {
    if (platform === "INSTAGRAM") return <span className="text-[#E4405F]">📸</span>;
    if (platform === "FACEBOOK") return <span className="text-[#1877F2]">📘</span>;
    return <MessageSquare className="size-3.5" />;
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] border border-border/60 rounded-2xl overflow-hidden bg-card">
      {/* Sidebar — Conversation List */}
      <div className="w-80 shrink-0 border-r border-border/60 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              DM Inbox
              <Badge variant="outline" className="text-[10px]">{dms.length}</Badge>
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={syncMutation}
              disabled={isSyncing}
            >
              <RefreshCw className={cn("size-3", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : "Sync"}
            </Button>
          </div>
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : dms.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs space-y-3">
              <Bot className="size-8 mx-auto opacity-40 text-primary" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">No conversations yet</p>
                <p className="text-[11px]">Sync customer inquiries from your connected Instagram & Facebook accounts.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 mx-auto"
                onClick={syncMutation}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("size-3", isSyncing && "animate-spin")} />
                {isSyncing ? "Syncing..." : "Sync Conversations"}
              </Button>
            </div>
          ) : (
            dms.map((dm) => (
              <button
                key={dm.id}
                onClick={() => { setSelected(dm); setReplyText(""); }}
                className={cn(
                  "w-full text-left p-3 border-b border-border/40 hover:bg-muted/40 transition-colors",
                  selected?.id === dm.id && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {dm.sender_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <PlatformIcon platform={dm.platform} />
                        <p className="text-xs font-semibold text-foreground truncate">{dm.sender_name}</p>
                        {!dm.is_read && (
                          <span className="size-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{dm.last_message}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(dm.last_message_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main — Conversation Detail */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div className="space-y-2">
              <MessageSquare className="size-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs">Click any DM from the left to view and reply</p>
            </div>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                  {selected.sender_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{selected.sender_name}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <PlatformIcon platform={selected.platform} />
                    <span>{selected.platform}</span>
                    {selected.last_replied_at && (
                      <>
                        <span>·</span>
                        <CheckCheck className="size-3 text-emerald-500" />
                        <span>Replied</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                <Clock className="size-3 mr-1" />
                {new Date(selected.last_message_at).toLocaleString()}
              </Badge>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(selected.raw_messages || []).slice().reverse().map((msg: any, i: number) => {
                const isFromSender = msg.from?.id === selected.sender_id;
                return (
                  <div key={i} className={cn("flex", isFromSender ? "justify-start" : "justify-end")}>
                    <div className={cn(
                      "max-w-xs px-3 py-2 rounded-2xl text-xs",
                      isFromSender
                        ? "bg-muted text-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    )}>
                      {msg.message}
                      <div className="text-[10px] opacity-60 mt-1">
                        {new Date(msg.created_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Show last message if no raw_messages */}
              {(!selected.raw_messages || selected.raw_messages.length === 0) && (
                <div className="flex justify-start">
                  <div className="max-w-xs px-3 py-2 rounded-2xl rounded-tl-sm bg-muted text-foreground text-xs">
                    {selected.last_message}
                    <div className="text-[10px] opacity-60 mt-1">
                      {new Date(selected.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              )}
              {/* Show last reply if exists */}
              {selected.last_reply && (
                <div className="flex justify-end">
                  <div className="max-w-xs px-3 py-2 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-xs">
                    {selected.last_reply}
                    {selected.last_replied_at && (
                      <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                        <CheckCheck className="size-3" />
                        {new Date(selected.last_replied_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reply Composer */}
            <div className="p-4 border-t border-border/60 space-y-2">
              <Textarea
                placeholder="Type your reply... or click AI Reply to auto-generate"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
              <div className="flex items-center gap-2 justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => replyMutation.mutate({ aiGenerate: true })}
                  disabled={replyMutation.isPending}
                >
                  <Sparkles className="size-3.5 text-primary" />
                  AI Reply
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => replyMutation.mutate({ aiGenerate: false })}
                  disabled={replyMutation.isPending || !replyText.trim()}
                >
                  <Send className="size-3.5" />
                  {replyMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
