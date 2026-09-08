"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Phone,
  PhoneCall,
  Clock,
  CheckCircle,
  Sparkles,
  User,
  RefreshCw,
  Zap,
  Bot,
  Loader2,
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400", icon: "✅" },
  voicemail: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400", icon: "📱" },
  no_answer: { color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400", icon: "❌" },
  in_progress: { color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", icon: "🔄" },
  initiated: { color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400", icon: "⚡" },
};

export default function AICallingPage() {
  const queryClient = useQueryClient();
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");

  // Query real call logs and stats from backend
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["voice-call-logs"],
    queryFn: async () => {
      const res = await fetch("/api/voice/call-lead");
      if (!res.ok) throw new Error("Failed to load voice logs");
      return res.json();
    },
  });

  const callLogs = data?.callLogs || [];
  const statsData = data?.stats || {
    totalCalls: 0,
    bookedCalls: 0,
    avgDuration: "0m 00s",
    connectionRate: "0%",
  };
  const autoCallConfig = data?.autoCallConfig || {
    enabled: false,
    minScore: 7,
    brandTone: "Professional",
  };

  const [autoCallEnabled, setAutoCallEnabled] = useState<boolean>(autoCallConfig.enabled);

  // Sync config when loaded
  useEffect(() => {
    if (autoCallConfig.enabled !== undefined) {
      setAutoCallEnabled(autoCallConfig.enabled);
    }
  }, [autoCallConfig.enabled]);

  // Toggle Auto-Call Mutation
  const autoCallMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_call_enabled: enabled,
          auto_call_min_score: 7,
          business_name: "Brand",
          niche: "Business",
          target_audience: "Clients",
        }),
      });
      if (!res.ok) throw new Error("Failed to update auto-call configuration");
      return res.json();
    },
    onSuccess: (_, enabled) => {
      setAutoCallEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ["voice-call-logs"] });
      toast.success(
        enabled
          ? "Autonomous Auto-Calling Activated for High-Intent Leads (Score ≥ 7)!"
          : "Auto-Calling Paused. Manual dispatch remains active."
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update configuration");
    },
  });

  // Manual Call Mutation
  const manualCallMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/call-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: manualPhone.trim(),
          name: manualName.trim(),
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to dispatch call");
      return resData;
    },
    onSuccess: (resData) => {
      toast.success(
        resData.simulated
          ? `[Simulated Call] AI Call dispatched to ${manualPhone}!`
          : `Live Call Dispatched via Vapi.ai! Call ID: ${resData.callId}`
      );
      setManualPhone("");
      setManualName("");
      queryClient.invalidateQueries({ queryKey: ["voice-call-logs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Call dispatch failed");
    },
  });

  const stats = [
    { label: "Total Dispatched Calls", value: statsData.totalCalls, icon: Phone, color: "text-blue-500" },
    { label: "Appointments Booked", value: statsData.bookedCalls, icon: CheckCircle, color: "text-green-500" },
    { label: "Avg Call Duration", value: statsData.avgDuration, icon: Clock, color: "text-orange-500" },
    { label: "Connection Rate", value: statsData.connectionRate, icon: PhoneCall, color: "text-purple-500" },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Phone className="size-6 text-primary" /> AI Voice Calling Agent
            </h1>
            <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-200">
              Interactive Demo Mode
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Simulate and preview autonomous voice qualification, real-time BANT evaluation, and calendar booking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Hero Banner */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Autonomous Inbound & Outbound Calling Engine — Powered by Vapi.ai</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When a lead scores ≥ 7 via website chatbot, WhatsApp, or form submission, the AI Voice agent can automatically call them within 2 minutes. The agent qualifies budget, timeline, and books directly into your calendar.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["Ultra-low latency (<600ms)", "Natural Voice synthesis", "BANT Qualification", "Cal.com Instant Booking", "Real-time CRM Sync"].map((f) => (
                <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-4 flex items-center gap-3">
              <s.icon className={`size-5 ${s.color}`} />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Manual Call Trigger */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PhoneCall className="size-4 text-green-500" /> Manual AI Call
            </CardTitle>
            <CardDescription className="text-xs">
              Test or instantly trigger an AI voice call to any prospect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lead / Prospect Name</Label>
              <Input
                placeholder="e.g. John Doe"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number (with country code)</Label>
              <Input
                placeholder="+91 98765 43210"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="text-sm font-mono"
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={!manualPhone || !manualName || manualCallMutation.isPending}
              onClick={() => manualCallMutation.mutate()}
            >
              {manualCallMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Dispatching Call...
                </>
              ) : (
                <>
                  <PhoneCall className="size-4" /> Call Now (AI Voice)
                </>
              )}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Dispatches call via Vapi.ai with fallback simulator
            </p>
          </CardContent>
        </Card>

        {/* Auto-Call Settings */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="size-4 text-primary" /> Autonomous Auto-Call Triggers
            </CardTitle>
            <CardDescription className="text-xs">
              Configure autonomous calling rules for incoming CRM leads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-muted/40 border">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Auto-Call High-Intent Leads (Score ≥ 7)</p>
                <p className="text-xs text-muted-foreground">
                  Automatically dispatch voice agent when BANT qualification scores 7 or higher
                </p>
              </div>
              <Switch
                checked={autoCallEnabled}
                onCheckedChange={(checked) => autoCallMutation.mutate(checked)}
                disabled={autoCallMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg bg-muted/40 border">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Inbound AI Receptionist</p>
                <p className="text-xs text-muted-foreground">
                  Answers incoming business calls and logs caller details directly into CRM
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Webhook Ready
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg bg-muted/40 border">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Active Voice Persona Grounding</p>
                <p className="text-xs text-muted-foreground">
                  Voice persona: Alex · Tone: {autoCallConfig.brandTone} · Calendar Sync Active
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Live Voice Call Activity Logs
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time activity records from outbound and inbound AI telephone calls
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {callLogs.length} Records
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading call logs...
            </div>
          ) : callLogs.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed rounded-xl">
              <Bot className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">No voice calls recorded yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Use the Manual AI Call panel above or enable Auto-Calling to start reaching out to prospects.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {callLogs.map((call: any) => {
                const config = STATUS_CONFIG[call.status] || STATUS_CONFIG.completed;
                return (
                  <div
                    key={call.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{call.leadName}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${config.color}`}>
                          {config.icon} {call.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {call.phone} · {call.duration} · {call.timeAgo}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-foreground">{call.outcome}</p>
                      <p className="text-xs text-muted-foreground">Intent Score: {call.score}/10</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
