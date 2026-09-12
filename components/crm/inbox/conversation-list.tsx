"use client";

import React, { useState } from "react";
import type { CRMConversation } from "@/lib/crm-service";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  MessageSquare,
  Phone,
  Search,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: CRMConversation[];
  selectedId: string | null;
  onSelect: (conv: CRMConversation) => void;
  onNewConversation?: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageSquare className="size-3.5 text-emerald-500" />;
      case "website":
        return <Globe className="size-3.5 text-sky-500" />;
      case "voice":
        return <Phone className="size-3.5 text-amber-500" />;
      case "instagram":
        return (
          <svg className="size-3.5 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        );
      case "facebook":
        return (
          <svg className="size-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
        );
      default:
        return <Globe className="size-3.5 text-muted-foreground" />;
    }
  };

  const filtered = conversations.filter((c) => {
    const name = c.lead?.name?.toLowerCase() || "";
    const email = c.lead?.email?.toLowerCase() || "";
    const lastMsg = c.messages?.[c.messages.length - 1]?.content?.toLowerCase() || "";
    const q = search.toLowerCase();
    return name.includes(q) || email.includes(q) || lastMsg.includes(q);
  });

  return (
    <div className="flex flex-col h-full min-h-0 border-r border-border/70 bg-card/40">
      {/* Search & New Chat Header */}
      <div className="p-2.5 border-b border-border/60 flex items-center gap-1.5 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads..."
            className="pl-8 h-8 text-xs bg-background/80"
          />
        </div>

        {onNewConversation && (
          <button
            type="button"
            onClick={onNewConversation}
            className="h-8 px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center gap-1"
            title="Start new thread"
          >
            + New
          </button>
        )}
      </div>

      {/* Threads List */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40 scrollbar-thin">
        {filtered.map((conv) => {
          const isSelected = conv.id === selectedId;
          const lastMsg = conv.messages?.[conv.messages.length - 1];
          const leadName = conv.lead?.name || "Prospect";
          const score = conv.lead?.score;

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={cn(
                "p-3 cursor-pointer transition-colors hover:bg-muted/40 text-left relative",
                isSelected && "bg-muted/70 border-l-2 border-primary"
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground truncate">
                  {getChannelIcon(conv.channel)}
                  <span className="truncate">{leadName}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(conv.last_message_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5 pr-2">
                {lastMsg ? lastMsg.content : "Conversation opened"}
              </p>

              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className="capitalize text-muted-foreground font-medium">
                  {conv.channel}
                </span>

                <div className="flex items-center gap-1">
                  {conv.is_ai_active ? (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 text-primary border-primary/30">
                      <Bot className="size-2.5" />
                      AI
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-4 px-1 text-[9px] text-amber-500 border-amber-500/30">
                      Human
                    </Badge>
                  )}
                  {score !== undefined && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1 text-[9px] font-semibold bg-muted"
                    >
                      {score}/10
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No active conversations match your query.
          </div>
        )}
      </div>
    </div>
  );
}
