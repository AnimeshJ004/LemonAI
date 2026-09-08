"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Calendar,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WidgetMessage {
  id: string;
  sender: "visitor" | "bot";
  text: string;
  bookingUrl?: string;
  timestamp: string;
}

interface WebsiteChatWidgetProps {
  userId?: string;
  brandName?: string;
  primaryColor?: string;
}

export function WebsiteChatWidget({
  userId = "user_lemon_default",
  brandName = "Lemon AI",
}: WebsiteChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: "welcome-1",
      sender: "bot",
      text: `Hi there! 👋 Welcome to ${brandName}. I can answer questions about our growth services, social automation, and pricing. How can I help you today?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [contactCaptured, setContactCaptured] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userText = input.trim();
    setInput("");

    const newMsg: WidgetMessage = {
      id: `msg_${Date.now()}`,
      sender: "visitor",
      text: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversationId,
          userId,
        }),
      });

      const data = await res.json();
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.leadId) setContactCaptured(true);

      const botReply: WidgetMessage = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: data.reply || `Thank you! Our team has received your message.`,
        bookingUrl: data.bookingUrl,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: "bot",
          text: "Thank you for reaching out! Please leave your email and we'll reply right away.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Expanded Chat Box */}
      {isOpen && (
        <Card className="w-[360px] sm:w-[400px] h-[520px] shadow-2xl border border-border/80 flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Widget Header */}
          <CardHeader className="p-3.5 bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-xs leading-none">{brandName} AI Assistant</h3>
                <span className="text-[10px] text-primary-foreground/80 flex items-center gap-1 mt-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online • Typically replies instantly
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="size-7 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
            >
              <ChevronDown className="size-4" />
            </Button>
          </CardHeader>

          {/* Messages Container */}
          <CardContent className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs bg-muted/20 scrollbar-thin">
            {messages.map((m) => {
              const isBot = m.sender === "bot";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-start gap-2 max-w-[85%]",
                    isBot ? "mr-auto" : "ml-auto flex-row-reverse"
                  )}
                >
                  <Avatar className="size-6 shrink-0 mt-0.5">
                    <AvatarFallback
                      className={cn(
                        "text-[9px] font-bold",
                        isBot
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isBot ? <Bot className="size-3" /> : <User className="size-3" />}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-1">
                    <div
                      className={cn(
                        "rounded-2xl px-3 py-2 text-xs shadow-xs leading-relaxed",
                        isBot
                          ? "bg-card border border-border/70 text-foreground rounded-tl-xs"
                          : "bg-primary text-primary-foreground rounded-tr-xs"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>

                    {/* Cal.com booking button in message if present */}
                    {m.bookingUrl && (
                      <a
                        href={m.bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-[11px] font-semibold transition-colors mt-1"
                      >
                        <Calendar className="size-3" />
                        <span>Book 15-min Discovery Call</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] pl-8">
                <span className="animate-pulse">Assistant is typing...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>

          {/* Footer Input */}
          <CardFooter className="p-2.5 border-t border-border/60 bg-card gap-1.5">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask a question or leave your email..."
              className="text-xs h-9 bg-background"
            />
            <Button
              size="icon"
              disabled={!input.trim() || isTyping}
              onClick={handleSend}
              className="size-9 shrink-0"
            >
              <Send className="size-3.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Floating Bubble Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="size-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center p-0 transition-transform active:scale-95"
        aria-label="Toggle Live Chat"
      >
        {isOpen ? (
          <X className="size-6" />
        ) : (
          <div className="relative">
            <MessageSquare className="size-6" />
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
          </div>
        )}
      </Button>
    </div>
  );
}
