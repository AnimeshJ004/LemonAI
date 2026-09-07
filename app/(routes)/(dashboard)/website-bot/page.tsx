"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Globe, Copy, Check, MessageCircle, Sparkles, Send, Bot, ShieldCheck, Code } from "lucide-react";
import { toast } from "sonner";

export default function WebsiteBotPage() {
  const { user } = useUser();
  const userId = user?.id || "usr_lemon_demo";
  const [copied, setCopied] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const embedCode = `<!-- Lemon AI Autonomous Chatbot Widget -->
<script>
  window.LEMON_BOT_USER_ID = "${userId}";
  window.LEMON_BOT_THEME = "light";
</script>
<script src="${typeof window !== "undefined" ? window.location.origin : "https://lemonai.app"}/chatbot-widget.js" async></script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Widget code copied to clipboard!");
  };

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
      setChat((c) => [...c, { role: "bot", text: data.reply || "Thanks! How can I assist you further?" }]);
    } catch {
      setChat((c) => [...c, { role: "bot", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="size-6 text-primary" /> Website AI Chatbot
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deploy an intelligent, 24/7 sales & lead qualification chatbot directly onto your website
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column: Embed code & Setup Instructions */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="size-4 text-primary" /> Embed Script
              </CardTitle>
              <CardDescription>
                Paste this snippet right before the closing &lt;/body&gt; tag of your site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="text-xs bg-muted/70 p-3.5 rounded-xl overflow-x-auto font-mono text-foreground/90 whitespace-pre-wrap break-all border">
                  {embedCode}
                </pre>
              </div>
              <Button onClick={copyEmbed} variant="outline" className="w-full gap-2 text-xs font-semibold">
                {copied ? (
                  <>
                    <Check className="size-4 text-emerald-500" /> Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copy Embed Script
                  </>
                )}
              </Button>

              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold text-foreground">Supported Platforms & CMS:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Shopify", "WordPress / WooCommerce", "Webflow", "Wix", "Framer", "Custom HTML / Next.js"].map((p) => (
                    <Badge key={p} variant="secondary" className="text-[11px]">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-emerald-200/60 bg-emerald-50/20 dark:bg-emerald-950/10">
            <CardContent className="pt-4 flex items-start gap-3">
              <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-emerald-900 dark:text-emerald-300">Brand DNA Grounded</p>
                <p className="text-muted-foreground">
                  The bot automatically pulls answers from your active Brand Profile, product catalog, and AI memory items to ensure accurate, zero-hallucination responses.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Interactive Bot Simulator */}
        <div className="lg:col-span-6">
          <Card className="shadow-sm border-primary/20 flex flex-col h-[520px]">
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
                <Badge variant="outline" className="text-[10px]">Test Mode</Badge>
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
                    Hello! 👋 Welcome to our website. How can I help you learn more about our services or book a call today?
                  </p>
                </div>
              </div>

              {chat.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
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
                        ? "bg-background border text-foreground rounded-tl-none"
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
                    <span>Typing answer</span>
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
                placeholder="Ask about pricing, offers, features..."
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
    </div>
  );
}
