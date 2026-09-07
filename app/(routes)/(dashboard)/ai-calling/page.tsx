"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneCall, Clock, CheckCircle, Sparkles, User } from "lucide-react";

const MOCK_CALL_LOGS = [
  { id: 1, leadName: "Rahul Sharma", phone: "+91 98765 43210", status: "completed", duration: "4m 32s", outcome: "Appointment Booked", score: 8, time: "2 hours ago" },
  { id: 2, leadName: "Priya Patel", phone: "+91 87654 32109", status: "voicemail", duration: "0m 45s", outcome: "Voicemail Left", score: 6, time: "4 hours ago" },
  { id: 3, leadName: "Amit Singh", phone: "+91 76543 21098", status: "completed", duration: "2m 15s", outcome: "Not Interested", score: 2, time: "Yesterday" },
  { id: 4, leadName: "Neha Gupta", phone: "+91 65432 10987", status: "completed", duration: "7m 01s", outcome: "Qualified - Follow Up", score: 7, time: "Yesterday" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400", icon: "✅" },
  voicemail: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400", icon: "📱" },
  no_answer: { color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400", icon: "❌" },
  in_progress: { color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", icon: "🔄" },
};

export default function AICallingPage() {
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [isCalling, setIsCalling] = useState(false);

  const stats = [
    { label: "Calls Today", value: "12", icon: Phone, color: "text-blue-500" },
    { label: "Appointments Booked", value: "3", icon: CheckCircle, color: "text-green-500" },
    { label: "Avg Call Duration", value: "3m 42s", icon: Clock, color: "text-orange-500" },
    { label: "Connection Rate", value: "67%", icon: PhoneCall, color: "text-purple-500" },
  ];

  const handleManualCall = async () => {
    if (!manualPhone || !manualName) return;
    setIsCalling(true);
    try {
      const res = await fetch("/api/voice/call-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: manualPhone,
          name: manualName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.simulated ? `[Simulated] Call dispatched to ${manualPhone}` : `Call dispatched via Vapi.ai! Call ID: ${data.callId}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Call failed: ${err.message}`);
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Phone className="size-6 text-primary" /> AI Voice Calling Agent
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI calls your leads, qualifies them with BANT, and books appointments automatically
        </p>
      </div>

      {/* Hero Banner */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">AI Calling Engine — Powered by Vapi.ai</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The AI voice calling agent uses real-time conversational speech synthesis, BANT qualification, and Cal.com integration. When configured, the agent automatically calls qualified leads within minutes of arrival.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["Ultra-low latency (<600ms)", "Natural conversation", "Auto appointment booking", "Call recordings", "Transcript analysis"].map((f) => (
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PhoneCall className="size-4 text-green-500" /> Manual AI Call
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Name</Label>
              <Input
                placeholder="John Doe"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <Input
                placeholder="+91 98765 43210"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={!manualPhone || !manualName || isCalling}
              onClick={handleManualCall}
            >
              <PhoneCall className="size-4" />
              {isCalling ? "Dispatching Call..." : "Call Now (AI)"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Direct connection to Vapi.ai agent endpoint
            </p>
          </CardContent>
        </Card>

        {/* Auto-Call Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">⚙️ Auto-Call Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-sm font-medium">Auto-Call High-Intent Leads</p>
                <p className="text-xs text-muted-foreground">
                  Automatically call leads with score ≥ 7 within 2 minutes of CRM ingestion
                </p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Ready</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-sm font-medium">Inbound AI Receptionist</p>
                <p className="text-xs text-muted-foreground">
                  AI answers your business phone line and creates CRM prospects
                </p>
              </div>
              <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">Webhook Ready</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-sm font-medium">Call Objective: BANT Qualification</p>
                <p className="text-xs text-muted-foreground">
                  Budget, Authority, Need, Timeline — AI extracts all 4 scores during call
                </p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">📋 Recent Call Logs</CardTitle>
            <Badge variant="outline" className="text-xs">Live Voice Logs</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MOCK_CALL_LOGS.map((call) => {
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
                      <p className="text-sm font-medium">{call.leadName}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${config.color}`}>
                        {config.icon} {call.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {call.phone} · {call.duration} · {call.time}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">{call.outcome}</p>
                    <p className="text-xs text-muted-foreground">Intent: {call.score}/10</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
