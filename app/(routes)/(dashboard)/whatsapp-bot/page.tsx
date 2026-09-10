"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  ExternalLink,
  CheckCircle,
  Copy,
  Check,
  Terminal,
  Send,
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  ArrowRight,
  Database,
  Smartphone,
  CheckCheck,
  ShieldCheck,
  Save,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const SETUP_STEPS = [
  {
    step: 1,
    title: "Create Meta Developer App",
    desc: "Navigate to developers.facebook.com → Create App → Select Business as the application type.",
    link: "https://developers.facebook.com/apps/create/",
  },
  {
    step: 2,
    title: "Add WhatsApp Product",
    desc: "In your Meta App Dashboard, find 'WhatsApp' under Add Products and click 'Set Up'.",
  },
  {
    step: 3,
    title: "Configure Phone Number ID",
    desc: "Go to WhatsApp → API Setup → Copy the Phone Number ID and save in your system configuration.",
  },
  {
    step: 4,
    title: "Set Webhook Callback & Verify Token",
    desc: "Under WhatsApp → Configuration → Edit Webhook URL. Enter the callback URL and Verify Token shown below.",
  },
  {
    step: 5,
    title: "Set Environment Variables in .env.local",
    desc: "Store your permanent System User Access Token and Phone Number ID securely.",
  },
];

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: string;
}

export default function WhatsAppBotPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const userId = user?.id || "usr_lemon_demo";

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [phoneNumberIdInput, setPhoneNumberIdInput] = useState("");

  // Simulator chat state
  const [testMsg, setTestMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      sender: "bot",
      text: "Hello! 👋 Welcome to our official WhatsApp sales concierge. I can answer inquiries, tell you our available consultation slots, share creative growth ideas, or book your appointment. How can I help you today?",
      time: "Just now",
    },
  ]);

  // Fetch brand profile
  const { data: brandData } = useQuery({
    queryKey: ["brand-profile", userId],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const activeProfile = brandData?.profile;
  const businessName = activeProfile?.business_name || "Lemon AI Brand";
  const dbBookingUrl = activeProfile?.booking_url || "";

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/social/whatsapp`
      : "https://your-domain.com/api/social/whatsapp";

  const verifyToken = "lemon_ai_whatsapp";

  const envSnippet = `WHATSAPP_ACCESS_TOKEN=your_permanent_access_token_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=lemon_ai_whatsapp
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(`${label} copied!`);
  };

  // Send message in WhatsApp Simulator
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || testMsg).trim();
    if (!textToSend || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, sender: "user", text: textToSend, time: now },
    ]);
    if (!customText) setTestMsg("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/social/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          from: "+15550198342",
          userId,
          isSimulator: true,
          senderName: user?.fullName || "WhatsApp Prospect",
        }),
      });

      const data = await res.json();
      const botReply = data.reply || "Thank you for reaching out! How can I assist you further?";

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: botReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      if (data.isBooked) {
        toast.success(`🎉 Appointment booked for ${data.bookingDate || "requested time"}! Synced to CRM.`);
        queryClient.invalidateQueries({ queryKey: ["crm-leads-appointments"] });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: "I am having trouble connecting right now. Please try again in a moment.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Phone Number ID Mutation
  const savePhoneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(activeProfile || {}),
          business_name: businessName,
          niche: activeProfile?.niche || "Professional Services",
          target_audience: activeProfile?.target_audience || "Valued Clients",
          whatsapp_phone_number_id: phoneNumberIdInput.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save Phone Number ID");
      return res.json();
    },
    onSuccess: () => {
      toast.success("WhatsApp Phone Number ID saved to your Brand Profile!");
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save configuration");
    },
  });

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="size-6 text-emerald-500" /> WhatsApp AI Sales Concierge
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Autonomous 24/7 WhatsApp assistant that answers customer inquiries, shares consultation slots, and books appointments straight to your CRM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/appointments">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Calendar className="size-3.5" /> View Bookings
            </Button>
          </Link>
          <Link href="/crm/inbox">
            <Button size="sm" className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              Omnichannel Inbox <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="simulator" className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="simulator" className="text-xs">
            WhatsApp Simulator
          </TabsTrigger>
          <TabsTrigger value="setup" className="text-xs">
            Meta API Setup
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">
            Slot & Booking Rules
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INTERACTIVE WHATSAPP SIMULATOR */}
        <TabsContent value="simulator" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* WhatsApp Phone Mockup */}
            <div className="lg:col-span-2 bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[560px]">
              {/* WhatsApp Header */}
              <div className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-emerald-800 border-2 border-emerald-500 flex items-center justify-center font-bold text-sm text-white">
                    {businessName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold leading-none">{businessName}</h3>
                    <p className="text-[11px] text-emerald-200 mt-0.5 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-300 animate-pulse"></span> online • AI Sales Concierge
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] text-white border-white/30 bg-emerald-800/60">
                  WhatsApp Cloud API
                </Badge>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/30 dark:bg-muted/10">
                <div className="text-center my-2">
                  <span className="text-[10px] bg-background/80 text-muted-foreground px-2 py-1 rounded shadow-xs border">
                    🔒 Messages are end-to-end simulated & logged to CRM
                  </span>
                </div>

                {messages.map((m) => {
                  const isUser = m.sender === "user";
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-xs leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? "bg-emerald-600 text-white rounded-tr-none"
                            : "bg-background text-foreground border rounded-tl-none"
                        }`}
                      >
                        {m.text}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                            isUser ? "text-emerald-100" : "text-muted-foreground"
                          }`}
                        >
                          <span>{m.time}</span>
                          {isUser && <CheckCheck className="size-3 text-emerald-200" />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-start">
                    <div className="bg-background border rounded-xl rounded-tl-none px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-xs">
                      <Loader2 className="size-3.5 animate-spin text-emerald-600" />
                      <span>Typing...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Message Input Bar */}
              <div className="p-3 bg-background border-t flex items-center gap-2">
                <Input
                  placeholder="Type a message (e.g. 'What slots are available?')..."
                  value={testMsg}
                  onChange={(e) => setTestMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="text-xs h-10 flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => handleSendMessage()}
                  disabled={!testMsg.trim() || isLoading}
                  className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>

            {/* Quick Test Prompt Cards & Tips */}
            <div className="space-y-4">
              <Card className="border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/15 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-emerald-900 dark:text-emerald-300">
                    <Sparkles className="size-4 text-emerald-600" /> Quick Test Prompts
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Click any prompt to send it instantly to your WhatsApp bot:
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {[
                    {
                      label: "Ask for Slots",
                      text: "What slots are available for booking?",
                      icon: Clock,
                    },
                    {
                      label: "Ask for Ideas",
                      text: "Give me some creative marketing and AI automation ideas",
                      icon: Sparkles,
                    },
                    {
                      label: "Book Appointment",
                      text: "Book my appointment for Friday at 4pm",
                      icon: Calendar,
                    },
                    {
                      label: "Check Pricing & Services",
                      text: "What services do you offer and what is your pricing?",
                      icon: Database,
                    },
                  ].map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(chip.text)}
                      disabled={isLoading}
                      className="w-full text-left p-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors flex items-center justify-between text-xs group"
                    >
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <chip.icon className="size-3.5 text-emerald-600 shrink-0" />
                        {chip.label}
                      </span>
                      <ArrowRight className="size-3 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-primary" /> Autonomous CRM Sync
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground pt-0">
                  <p>
                    When customers chat with this bot and book a slot, their contact and appointment details automatically sync to:
                  </p>
                  <ul className="space-y-1 list-disc list-inside text-foreground/90 font-medium">
                    <li><Link href="/appointments" className="text-primary hover:underline">CRM Appointments Section</Link></li>
                    <li><Link href="/crm/pipeline" className="text-primary hover:underline">Pipeline Kanban (Booked stage)</Link></li>
                    <li><Link href="/crm/inbox" className="text-primary hover:underline">Unified Omnichannel Inbox</Link></li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: META DEVELOPER SETUP */}
        <TabsContent value="setup" className="space-y-4">
          {/* Status banner */}
          <Card className="border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/15 shadow-xs">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                  Official Webhook Endpoint Live
                </p>
                <p className="text-xs text-muted-foreground">
                  Your Lemon AI webhook handler accepts incoming customer messages from Meta Cloud API and pushes replies automatically.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Webhook credentials */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">🔗 Webhook Configuration Parameters</CardTitle>
              <CardDescription>
                Copy these exact values into your Meta Developer WhatsApp Webhook setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Callback URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookUrl} className="text-xs font-mono bg-muted/40" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl, setCopiedUrl, "Webhook URL")}
                    className="gap-1.5 text-xs shrink-0"
                  >
                    {copiedUrl ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Verify Token</Label>
                <div className="flex gap-2">
                  <Input readOnly value={verifyToken} className="text-xs font-mono bg-muted/40" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(verifyToken, setCopiedToken, "Verify token")}
                    className="gap-1.5 text-xs shrink-0"
                  >
                    {copiedToken ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    Copy
                  </Button>
                </div>
              </div>

              {/* Phone Number ID Mapping */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold">Your WhatsApp Phone Number ID (from Meta API Setup)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 109283746501928"
                    value={phoneNumberIdInput}
                    onChange={(e) => setPhoneNumberIdInput(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={() => savePhoneMutation.mutate()}
                    disabled={!phoneNumberIdInput.trim() || savePhoneMutation.isPending}
                    className="text-xs gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {savePhoneMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save ID
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Saves this phone number ID to your brand profile so incoming messages from Meta are routed directly to your account.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold">Required Webhook Subscription Fields:</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {["messages", "message_deliveries", "message_reads"].map((field) => (
                    <Badge key={field} variant="secondary" className="text-xs font-mono">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step by Step Setup Guide */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">📋 Step-by-Step Meta Integration</CardTitle>
              <CardDescription>Follow these 5 simple steps to link your WhatsApp Business account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {SETUP_STEPS.map((s) => (
                <div key={s.step} className="flex items-start gap-3.5 p-3 rounded-xl border hover:bg-muted/30 transition-all">
                  <div className="size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{s.desc}</p>
                    {s.link && (
                      <Link
                        href={s.link}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline pt-1"
                      >
                        <ExternalLink className="size-3" /> Open Meta Developer Portal
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Environment variables snippet */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="size-4 text-primary" /> Environment Configuration
                </CardTitle>
                <CardDescription>Add these keys to your .env file</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(envSnippet, setCopiedEnv, "Environment configuration")}
                className="text-xs gap-1.5"
              >
                {copiedEnv ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                Copy .env
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/70 p-4 rounded-xl font-mono text-foreground/90 overflow-x-auto border">
                {envSnippet}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SLOT & BOOKING RULES */}
        <TabsContent value="rules" className="space-y-4">
          <Card className="shadow-xs border-primary/20">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Autonomous WhatsApp Scheduling Rules
              </CardTitle>
              <CardDescription className="text-xs">
                The standard rules and consultation slots your WhatsApp AI uses to reply to scheduling inquiries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" /> Working Days
                  </p>
                  <p className="text-muted-foreground">Monday through Saturday (6 days a week)</p>
                </div>
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary" /> Working Hours
                  </p>
                  <p className="text-muted-foreground">10:00 AM – 7:00 PM</p>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                <p className="font-semibold text-foreground">Standard Slots Offered in WhatsApp Conversations:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    "10:00 AM – 10:30 AM",
                    "11:30 AM – 12:00 PM",
                    "2:00 PM – 2:30 PM",
                    "3:30 PM – 4:00 PM",
                    "5:00 PM – 5:30 PM",
                    "7:00 PM – 7:30 PM",
                  ].map((slot, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-background border text-xs font-mono">
                      <Clock className="size-3 text-emerald-500" />
                      <span>{slot}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                <p className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Database className="size-3.5 text-emerald-600" /> Connected Calendar URL
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {dbBookingUrl || "No calendar link configured. Add one under Appointments."}
                </p>
                {dbBookingUrl && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    ● The WhatsApp Bot automatically provides this link when customers want to self-schedule.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
