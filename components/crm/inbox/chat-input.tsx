"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Calendar, Sparkles, Bot, MessageSquare } from "lucide-react";

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
  calLink,
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
    <div className="p-2.5 sm:p-3 border-t border-border/70 space-y-2 bg-card/60 shrink-0">
      {/* Canned Quick Replies & AI Action Buttons */}
      <div className="flex items-center justify-between gap-2 pb-0.5 text-[11px] overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0 flex-1 py-0.5">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase shrink-0 flex items-center gap-1">
            <Sparkles className="size-3 text-primary" />
            Quick Reply:
          </span>
          {cannedReplies.map((reply, idx) => (
            <Badge
              key={idx}
              variant="outline"
              onClick={() => setText(reply.template)}
              className="cursor-pointer hover:bg-muted/80 hover:border-primary/50 text-[10px] whitespace-nowrap transition-colors bg-background/60 shrink-0 select-none"
            >
              {reply.label}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onAIReply && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAIReply}
              disabled={isAIGenerating || disabled}
              className="h-6 sm:h-7 text-[10px] sm:text-[11px] px-2 gap-1 font-medium border-primary/40 text-primary hover:bg-primary/10"
            >
              <Bot className="size-3" />
              {isAIGenerating ? "Generating..." : "Let AI Reply"}
            </Button>
          )}
          {onSimulateInbound && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSimulateInbound}
              disabled={disabled}
              className="h-6 sm:h-7 text-[10px] px-1.5 gap-1 text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="size-3" />
              Simulate
            </Button>
          )}
        </div>
      </div>

      {/* Input Box */}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message as Human Agent (Enter to send, Shift+Enter for new line)..."
          rows={1}
          disabled={disabled}
          className="resize-none text-xs bg-background min-h-[44px] max-h-[80px] py-2"
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
