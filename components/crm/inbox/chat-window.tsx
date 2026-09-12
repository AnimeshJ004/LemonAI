"use client";

import React, { useEffect, useRef } from "react";
import type { CRMMessage } from "@/lib/crm-service";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  messages: CRMMessage[];
  leadName?: string;
}

export function ChatWindow({ messages, leadName }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
      {messages.map((msg) => {
        const isLead = msg.sender_type === "lead";
        const isAI = msg.sender_type === "ai_assistant";
        const isHuman = msg.sender_type === "human_agent";

        return (
          <div
            key={msg.id}
            className={cn(
              "flex items-start gap-2.5 max-w-[80%]",
              isLead ? "mr-auto" : "ml-auto flex-row-reverse"
            )}
          >
            {/* Sender Avatar */}
            <Avatar className="size-7 shrink-0 text-xs mt-0.5">
              <AvatarFallback
                className={cn(
                  "font-semibold text-[10px]",
                  isLead && "bg-muted text-muted-foreground",
                  isAI && "bg-primary/20 text-primary",
                  isHuman && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {isLead ? (
                  leadName ? leadName.slice(0, 2).toUpperCase() : <User className="size-3.5" />
                ) : isAI ? (
                  <Bot className="size-3.5" />
                ) : (
                  <UserCheck className="size-3.5" />
                )}
              </AvatarFallback>
            </Avatar>

            {/* Bubble Container */}
            <div className="space-y-1">
              <div
                className={cn(
                  "flex items-center gap-1.5 text-[10px] text-muted-foreground",
                  !isLead && "justify-end"
                )}
              >
                <span className="font-semibold">
                  {isLead
                    ? leadName || "Visitor"
                    : isAI
                      ? "AI Assistant"
                      : "Human Agent"}
                </span>
                <span>•</span>
                <span>
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs",
                  isLead && "bg-muted text-foreground rounded-tl-xs",
                  isAI && "bg-primary/10 text-foreground border border-primary/20 rounded-tr-xs",
                  isHuman && "bg-emerald-500/15 text-foreground border border-emerald-500/30 rounded-tr-xs"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
