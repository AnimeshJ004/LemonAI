"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Globe, Sparkles, Send, Bot } from "lucide-react";
import { toast } from "sonner";

export default function WebsiteBotPage() {
  const { user } = useUser();
  const userId = user?.id || "usr_lemon_demo";

  const [testMsg, setTestMsg] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const sendTestMessage = async () => {
    if (!testMsg.trim()) return;
    const userMsg = testMsg;
    setTestMsg("");
    setChat((c) => [...c, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, userId, sessionId: "preview-session" }),
      });
      const data = await res.json();
      setChat((c) => [
        ...c,
        { role: "bot", text: data.reply || "Thanks! How can I assist you further?" },
      ]);
    } catch {
      setChat((c) => [...c, { role: "bot", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-5 sm:space-y-6 w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-foreground">
            <Globe className="size-5 sm:size-6 text-primary shrink-0" />
            <span>Website AI Chatbot</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-2 md:line-clamp-none">
            Train, ground, and deploy an autonomous 24/7 sales & lead qualification chatbot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 border-emerald-300 gap-1.5 py-1">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Grounding Engine Live</span>
          </Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full">
        <Card className="shadow-sm border-primary/20 flex flex-col h-[580px]">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Bot className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Live Chat Preview</CardTitle>
                    <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online & Grounded
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Interactive Test
                </Badge>
              </div>
            </CardHeader>

            {/* Chat Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
              <div className="flex items-start gap-2">
                <div className="size-7 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="bg-background border rounded-2xl rounded-tl-none px-3.5 py-2.5 max-w-[85%] shadow-xs">
                  <p className="text-xs text-foreground">
                    Hello! 👋 Welcome. Ask me about our services, pricing, or how to book an appointment!
                  </p>
                </div>
              </div>

              {chat.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 ${
                    msg.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`size-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                      msg.role === "bot" ? "bg-primary text-white" : "bg-muted border font-semibold"
                    }`}
                  >
                    {msg.role === "bot" ? <Bot className="size-3.5" /> : "👤"}
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] text-xs shadow-xs ${
                      msg.role === "bot"
                        ? "bg-background border text-foreground rounded-tl-none leading-relaxed"
                        : "bg-primary text-primary-foreground rounded-tr-none"
                    }`}
                  >
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-2">
                  <div className="size-7 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                    <Sparkles className="size-3.5 animate-spin" />
                  </div>
                  <div className="bg-background border rounded-2xl rounded-tl-none px-3.5 py-2 text-xs text-muted-foreground flex items-center gap-1.5 shadow-xs">
                    <span>Thinking with trained knowledge</span>
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce delay-100">.</span>
                    <span className="animate-bounce delay-200">.</span>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Input box */}
            <div className="p-3 border-t bg-background flex gap-2">
              <Input
                placeholder="Ask about pricing, services, booking..."
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendTestMessage()}
                className="text-xs h-9"
              />
              <Button
                size="sm"
                onClick={sendTestMessage}
                disabled={loading || !testMsg.trim()}
                className="h-9 px-3 shrink-0"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
  );
}
