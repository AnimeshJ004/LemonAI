"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, ExternalLink, CheckCircle, AlertCircle, Copy, Check, Terminal } from "lucide-react";
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

export default function WhatsAppBotPage() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const webhookUrl = typeof window !== "undefined"
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

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="size-6 text-emerald-500" /> WhatsApp AI Sales Bot
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect official WhatsApp Cloud API for autonomous 24/7 inquiry handling and appointment booking
        </p>
      </div>

      {/* Status banner */}
      <Card className="border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/15 shadow-xs">
        <CardContent className="pt-4 flex items-center gap-3">
          <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Webhook Endpoint Ready</p>
            <p className="text-xs text-muted-foreground">
              Your Lemon AI webhook handler is live and accepts incoming customer messages from Meta's Cloud API.
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
            <CardDescription>Add these keys to your .env.local file</CardDescription>
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
    </div>
  );
}
