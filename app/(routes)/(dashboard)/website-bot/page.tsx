"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Globe,
  Copy,
  Check,
  Sparkles,
  Send,
  Bot,
  ShieldCheck,
  Code,
  Brain,
  Save,
  Loader2,
  Calendar,
  Briefcase,
  DollarSign,
  HelpCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export default function WebsiteBotPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const userId = user?.id || "usr_lemon_demo";

  const [copied, setCopied] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Training form state
  const [trainingData, setTrainingData] = useState({
    business_name: "",
    niche: "",
    target_audience: "",
    main_offer: "",
    products_services: "",
    pricing_details: "",
    booking_url: "",
    knowledge_docs: "",
    custom_rule: "",
  });

  // Fetch current brand profile to populate training fields
  const { data: brandResponse, isLoading: isBrandLoading } = useQuery({
    queryKey: ["brand-profile", userId],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (brandResponse?.profile) {
      const p = brandResponse.profile;
      setTrainingData((prev) => ({
        ...prev,
        business_name: p.business_name || "",
        niche: p.niche || "",
        target_audience: p.target_audience || "",
        main_offer: p.main_offer || "",
        products_services: p.products_services || "",
        pricing_details: p.pricing_details || "",
        booking_url: p.booking_url || "",
        knowledge_docs: p.knowledge_docs || "",
      }));
    }
  }, [brandResponse]);

  // Train Bot Mutation
  const trainMutation = useMutation({
    mutationFn: async () => {
      // 1. Save Brand Profile with Knowledge Base
      const brandRes = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: trainingData.business_name || "Lemon AI Brand",
          niche: trainingData.niche || "Digital Services & Growth",
          target_audience: trainingData.target_audience || "Prospective Clients",
          main_offer: trainingData.main_offer || "High-converting solutions",
          products_services: trainingData.products_services,
          pricing_details: trainingData.pricing_details,
          booking_url: trainingData.booking_url,
          knowledge_docs: trainingData.knowledge_docs,
        }),
      });

      if (!brandRes.ok) {
        const err = await brandRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save brand training");
      }

      // 2. If custom rule specified, record as explicit AI memory
      if (trainingData.custom_rule.trim()) {
        await fetch("/api/ai/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signalType: "explicit",
            feedbackText: trainingData.custom_rule.trim(),
          }),
        });
      }

      return brandRes.json();
    },
    onSuccess: () => {
      toast.success("Chatbot successfully trained with your brand knowledge!");
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
      // Add a greeting to chat simulator
      setChat((c) => [
        ...c,
        {
          role: "bot",
          text: `Brain updated! I am trained with ${trainingData.business_name || "your brand"} knowledge. Ask me anything to test!`,
        },
      ]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to train chatbot");
    },
  });

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
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="size-6 text-primary" /> Website AI Chatbot
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Train, ground, and deploy an autonomous 24/7 sales & lead qualification chatbot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 border-emerald-300 gap-1.5 py-1">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Grounding Engine Live
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Tabs for Training vs Embed */}
        <div className="lg:col-span-7 space-y-4">
          <Tabs defaultValue="train" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="train" className="gap-2 text-xs font-semibold">
                <Brain className="size-3.5 text-primary" /> Train & Ground Bot
              </TabsTrigger>
              <TabsTrigger value="embed" className="gap-2 text-xs font-semibold">
                <Code className="size-3.5 text-primary" /> Embed Script & Setup
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: TRAIN BOT */}
            <TabsContent value="train" className="space-y-4 mt-0">
              <Card className="shadow-sm border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" /> Knowledge Vault & Training
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Teach your chatbot your exact products, pricing, FAQs, and rules
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => trainMutation.mutate()}
                      disabled={trainMutation.isPending}
                      className="gap-1.5 text-xs font-semibold h-8"
                    >
                      {trainMutation.isPending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" /> Training...
                        </>
                      ) : (
                        <>
                          <Save className="size-3.5" /> Save & Train Bot
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Briefcase className="size-3.5 text-muted-foreground" /> Business Name
                      </Label>
                      <Input
                        placeholder="e.g. Acme Growth Agency"
                        value={trainingData.business_name}
                        onChange={(e) =>
                          setTrainingData({ ...trainingData, business_name: e.target.value })
                        }
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Zap className="size-3.5 text-muted-foreground" /> Niche / Industry
                      </Label>
                      <Input
                        placeholder="e.g. B2B SaaS Growth & Marketing"
                        value={trainingData.niche}
                        onChange={(e) =>
                          setTrainingData({ ...trainingData, niche: e.target.value })
                        }
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <DollarSign className="size-3.5 text-muted-foreground" /> Products, Services & Pricing
                    </Label>
                    <Textarea
                      placeholder="e.g. 1. Starter Funnel Setup ($499 one-time)&#10;2. Performance Ads Management ($1,200/month)&#10;3. AI Chatbot Integration ($299 one-time)&#10;Guarantee: 14-day money-back guarantee."
                      value={trainingData.products_services}
                      onChange={(e) =>
                        setTrainingData({ ...trainingData, products_services: e.target.value })
                      }
                      className="text-xs min-h-[68px] resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground" /> Booking Calendar URL (Calendly / Cal.com)
                    </Label>
                    <Input
                      placeholder="e.g. https://cal.com/your-team/15min"
                      value={trainingData.booking_url}
                      onChange={(e) =>
                        setTrainingData({ ...trainingData, booking_url: e.target.value })
                      }
                      className="text-xs h-8"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The bot automatically shares this link whenever a visitor wants to book a call.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <HelpCircle className="size-3.5 text-muted-foreground" /> FAQs, Objection Handlers & Knowledge Base
                    </Label>
                    <Textarea
                      placeholder="e.g. Q: How fast is onboarding? A: Within 48 hours.&#10;Q: Do you offer custom packages? A: Yes, we build tailored enterprise packages.&#10;Return policy: Full refunds within 30 days if unsatisfied."
                      value={trainingData.knowledge_docs}
                      onChange={(e) =>
                        setTrainingData({ ...trainingData, knowledge_docs: e.target.value })
                      }
                      className="text-xs min-h-[90px] resize-none leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                      <Sparkles className="size-3.5" /> Quick Behavioral Rule / Custom Instruction
                    </Label>
                    <Input
                      placeholder="e.g. If visitor asks about discounts, offer coupon code LEMON10 and ask for their email."
                      value={trainingData.custom_rule}
                      onChange={(e) =>
                        setTrainingData({ ...trainingData, custom_rule: e.target.value })
                      }
                      className="text-xs h-8"
                    />
                  </div>

                  <Button
                    onClick={() => trainMutation.mutate()}
                    disabled={trainMutation.isPending}
                    className="w-full gap-2 text-xs font-semibold h-9"
                  >
                    {trainMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Grounding & Training Bot...
                      </>
                    ) : (
                      <>
                        <Brain className="size-4" /> Train & Update Bot Brain
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: EMBED SCRIPT */}
            <TabsContent value="embed" className="space-y-4 mt-0">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code className="size-4 text-primary" /> Embed Script
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Paste this snippet right before the closing &lt;/body&gt; tag of your site
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <pre className="text-xs bg-muted/70 p-3.5 rounded-xl overflow-x-auto font-mono text-foreground/90 whitespace-pre-wrap break-all border">
                      {embedCode}
                    </pre>
                  </div>
                  <Button
                    onClick={copyEmbed}
                    variant="outline"
                    className="w-full gap-2 text-xs font-semibold"
                  >
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
                      {[
                        "Shopify",
                        "WordPress / WooCommerce",
                        "Webflow",
                        "Wix",
                        "Framer",
                        "Custom HTML / Next.js",
                      ].map((p) => (
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
                    <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                      Brand DNA Grounded & Protected
                    </p>
                    <p className="text-muted-foreground">
                      The bot automatically pulls answers from your Brand Profile, pricing catalog, and AI memory items to ensure accurate, zero-hallucination responses with strict prompt injection protection.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column: Interactive Bot Simulator */}
        <div className="lg:col-span-5">
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
    </div>
  );
}
