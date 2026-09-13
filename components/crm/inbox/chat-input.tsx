"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Bot, MessageSquare } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onAIReply?: () => void;
  onSimulateInbound?: () => void;
  isSending?: boolean;
  isAIGenerating?: boolean;
  disabled?: boolean;
  calLink?: string;
}

export function ChatInput({
  onSendMessage,
  onAIReply,
  onSimulateInbound,
  isSending,
  isAIGenerating,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState("");

  const cannedReplies = [
    {
      label: "Book Discovery Call",
      template:
        "I'd love to invite you to a 15-minute Strategy Session with our lead marketing strategist! Let me know what date and time works best for you this week.",
    },
    {
      label: "Send Pricing Sheet",
      template:
        "Here is our complete pricing breakdown and service deliverables. Feel free to review and let me know if you have any questions!",
    },
    {
      label: "Checking on this now",
      template:
        "Thank you for reaching out! I am reviewing your account details and will have an answer for you in just a couple minutes.",
    },
  ];

  const handleSend = () => {
    if (!text.trim() || isSending || disabled) return;
    onSendMessage(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-2.5 sm:p-3 border-t border-border/70 space-y-2 bg-card/60 w-full min-w-0 shrink-0">
      {/* Canned Quick Replies & AI Action Buttons */}
      <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center justify-between gap-2 pb-1 text-[11px]">
        {/* Horizontal scroll for canned replies on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 -mx-1 px-1 min-w-0">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase shrink-0 flex items-center gap-1">
            <Sparkles className="size-3 text-primary shrink-0" />
            <span className="hidden sm:inline">Quick Reply:</span>
          </span>
          {cannedReplies.map((reply, idx) => (
            <Badge
              key={idx}
              variant="outline"
              onClick={() => setText(reply.template)}
              className="cursor-pointer hover:bg-muted/80 hover:border-primary/50 text-[10px] whitespace-nowrap transition-colors bg-background/60 shrink-0 py-0.5 px-2"
            >
              {reply.label}
            </Badge>
          ))}
        </div>

        {/* Action buttons wrapper */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end w-full sm:w-auto">
          {onAIReply && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAIReply}
              disabled={isAIGenerating || disabled}
              className="h-7 text-[11px] gap-1.5 font-medium border-primary/40 text-primary hover:bg-primary/10 px-2.5"
            >
              <Bot className="size-3.5" />
              <span>{isAIGenerating ? "Generating..." : "Let AI Reply"}</span>
            </Button>
          )}
          {onSimulateInbound && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSimulateInbound}
              disabled={disabled}
              className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-2"
            >
              <MessageSquare className="size-3" />
              <span className="hidden sm:inline">Simulate Inbound</span>
              <span className="sm:hidden">Simulate</span>
            </Button>
          )}
        </div>
      </div>

      {/* Input Box */}
      <div className="flex items-end gap-2 min-w-0">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message as Human Agent..."
          rows={2}
          disabled={disabled}
          className="resize-none text-xs sm:text-xs bg-background min-h-[50px] sm:min-h-[52px] flex-1 min-w-0"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
          className="size-9 sm:size-10 shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
