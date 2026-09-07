"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Calendar, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isSending?: boolean;
  disabled?: boolean;
  calLink?: string;
}

export function ChatInput({
  onSendMessage,
  isSending,
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
    <div className="p-3 border-t border-border/70 space-y-2 bg-card/60">
      {/* Canned Quick Replies */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
        <span className="text-muted-foreground text-[10px] font-semibold uppercase shrink-0 flex items-center gap-1">
          <Sparkles className="size-3 text-primary" />
          Quick Reply:
        </span>
        {cannedReplies.map((reply, idx) => (
          <Badge
            key={idx}
            variant="outline"
            onClick={() => setText(reply.template)}
            className="cursor-pointer hover:bg-muted/80 hover:border-primary/50 text-[10px] whitespace-nowrap transition-colors bg-background/60"
          >
            {reply.label}
          </Badge>
        ))}
      </div>

      {/* Input Box */}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message as Human Agent (Enter to send, Shift+Enter for new line)..."
          rows={2}
          disabled={disabled}
          className="resize-none text-xs bg-background min-h-[52px]"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
          className="size-10 shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
