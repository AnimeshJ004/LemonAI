"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Phone,
  PhoneCall,
  Clock,
  CheckCircle2,
  Sparkles,
  Zap,
  Bot,
  Loader2,
  CalendarCheck,
  Search,
  Volume2,
  Play,
  Pause,
  Headphones,
  SlidersHorizontal,
  RotateCcw,
  Target,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface DummyCallRecord {
  id: string;
  leadName: string;
  phone: string;
  company: string;
  status: "booked" | "completed" | "voicemail" | "no_answer";
  duration: string;
  durationSeconds: number;
  outcome: string;
  score: number;
  timeAgo: string;
  timestamp: string;
  persona: string;
  bant: {
    budget: number;
    authority: number;
    need: number;
    timing: number;
    summary: string;
  };
  transcript: Array<{ speaker: "agent" | "prospect"; text: string; time: string }>;
}

const INITIAL_CALL_LOGS: DummyCallRecord[] = [
  {
    id: "call_01",
    leadName: "Rahul Sharma",
    phone: "+91 98231 44210",
    company: "Apex Tech Consulting",
    status: "booked",
    duration: "3m 45s",
    durationSeconds: 225,
    outcome: "Appointment Booked (Discovery Consultation)",
    score: 9,
    timeAgo: "15m ago",
    timestamp: "Today, 4:52 PM",
    persona: "Alex (Consultative)",
    bant: {
      budget: 9,
      authority: 10,
      need: 9,
      timing: 9,
      summary: "Founder looking for end-to-end multi-channel scheduling and automated lead capture. High buying intent.",
    },
    transcript: [
      { speaker: "agent", time: "0:02", text: "Hello Rahul! This is Alex from Lemon AI. I noticed your team requested information on automated social growth and lead qualification. Do you have two quick minutes?" },
      { speaker: "prospect", time: "0:12", text: "Hey Alex! Yes, perfect timing. We're currently scaling our agency to 25+ client accounts and manual scheduling is eating up 20 hours a week." },
      { speaker: "agent", time: "0:25", text: "That is precisely where our autonomous publishing and BANT inbound qualifier excel. Are you the primary decision maker for tooling choices at Apex?" },
      { speaker: "prospect", time: "0:36", text: "Yes, I am the founder and CEO. If the software handles multi-tenant workflows and meta sync seamlessly, we can onboard immediately." },
      { speaker: "agent", time: "0:47", text: "Outstanding. I'd love to lock in a dedicated 15-minute walkthrough with our head of product for tomorrow. How does 3:30 PM IST work for you?" },
      { speaker: "prospect", time: "0:58", text: "3:30 PM tomorrow works great. Send the calendar link to this number or email." },
      { speaker: "agent", time: "1:05", text: "Done! Calendar invite and WhatsApp confirmation dispatched. Have a wonderful day, Rahul!" },
    ],
  },
  {
    id: "call_02",
    leadName: "Priya Mehta",
    phone: "+91 91204 88319",
    company: "Velvet Retail Brands",
    status: "booked",
    duration: "2m 50s",
    durationSeconds: 170,
    outcome: "Appointment Booked (High-Ticket Pilot)",
    score: 8,
    timeAgo: "1h ago",
    timestamp: "Today, 3:45 PM",
    persona: "Sarah (Energetic)",
    bant: {
      budget: 8,
      authority: 8,
      need: 9,
      timing: 8,
      summary: "Marketing Director looking to replace Hootsuite with AI-driven content flywheel and WhatsApp inbound booking.",
    },
    transcript: [
      { speaker: "agent", time: "0:02", text: "Hi Priya! Sarah here with Lemon AI. Saw your inquiry regarding our viral flywheel content generator. Am I catching you at a good time?" },
      { speaker: "prospect", time: "0:10", text: "Hi Sarah! Yes, we're evaluating platforms to manage 4 e-commerce brand pages with AI auto-replies." },
      { speaker: "agent", time: "0:20", text: "Our multi-brand workspace was purpose-built for that. What is your implementation timeline for switching?" },
      { speaker: "prospect", time: "0:30", text: "We want to migrate before next quarter kicks off in two weeks." },
      { speaker: "agent", time: "0:40", text: "Perfect. Let's get you set up with a custom sandbox walkthrough on Friday at 11 AM." },
      { speaker: "prospect", time: "0:48", text: "Sounds excellent. Lock that in." },
    ],
  },
  {
    id: "call_03",
    leadName: "Vikram Roy",
    phone: "+91 97112 55901",
    company: "Horizon Fitness Clubs",
    status: "completed",
    duration: "4m 12s",
    durationSeconds: 252,
    outcome: "Lead Qualified (BANT 8/10)",
    score: 8,
    timeAgo: "3h ago",
    timestamp: "Today, 1:30 PM",
    persona: "Alex (Consultative)",
    bant: {
      budget: 7,
      authority: 8,
      need: 9,
      timing: 7,
      summary: "Qualified interest in automated local gym lead follow-ups via WhatsApp and Instagram DMs.",
    },
    transcript: [
      { speaker: "agent", time: "0:02", text: "Good afternoon Vikram! Alex calling from Lemon AI regarding gym member acquisition automation." },
      { speaker: "prospect", time: "0:14", text: "Hey! We get a ton of Instagram comments on our transformation reels but staff forgets to DM them back." },
      { speaker: "agent", time: "0:26", text: "Our instant comment-to-DM trigger responds in under 30 seconds and qualifies leads automatically. Let's review the pricing tiers." },
      { speaker: "prospect", time: "0:45", text: "Send me the one-pager on WhatsApp. I will review it with my ops manager tonight." },
    ],
  },
  {
    id: "call_04",
    leadName: "Neha Kapoor",
    phone: "+91 98765 12340",
    company: "Kapoor Digital Media",
    status: "voicemail",
    duration: "0m 45s",
    durationSeconds: 45,
    outcome: "Voicemail Dropped + Follow-up WhatsApp Sent",
    score: 6,
    timeAgo: "5h ago",
    timestamp: "Today, 11:15 AM",
    persona: "Alex (Consultative)",
    bant: {
      budget: 6,
      authority: 6,
      need: 7,
      timing: 5,
      summary: "Voicemail tone detected. Automated 20-second audio note and booking URL dropped to WhatsApp.",
    },
    transcript: [
      { speaker: "agent", time: "0:02", text: "Hi Neha, this is Alex with Lemon AI. I saw your request for our automated social calendar. I will leave our booking link in your WhatsApp so you can pick a time whenever convenient. Talk soon!" },
    ],
  },
  {
    id: "call_05",
    leadName: "Anand Verma",
    phone: "+91 98110 99201",
    company: "Zenith Real Estate",
    status: "booked",
    duration: "3m 15s",
    durationSeconds: 195,
    outcome: "Appointment Booked (High Intent)",
    score: 9,
    timeAgo: "Yesterday",
    timestamp: "Yesterday, 5:10 PM",
    persona: "David (Executive)",
    bant: {
      budget: 10,
      authority: 9,
      need: 9,
      timing: 9,
      summary: "Luxury real estate broker seeking instant WhatsApp & voice call dispatch when users click Meta Lead Ads.",
    },
    transcript: [
      { speaker: "agent", time: "0:02", text: "Hello Anand! David calling from Lemon AI regarding instantaneous lead outreach for Zenith properties." },
      { speaker: "prospect", time: "0:12", text: "Yes David. Speed to lead is everything for our luxury villas. If an inquiry sits for 10 minutes, they're gone." },
      { speaker: "agent", time: "0:24", text: "With Lemon AI, your voice agent calls verified leads within 90 seconds of Meta form submission. We have enterprise SLAs for this." },
      { speaker: "prospect", time: "0:38", text: "That is exactly what we need. Let's schedule a pilot deployment call." },
    ],
  },
  {
    id: "call_06",
    leadName: "Kavita Reddy",
    phone: "+91 99002 43118",
    company: "Reddy FinTech Advisors",
    status: "no_answer",
    duration: "0m 30s",
    durationSeconds: 30,
    outcome: "Call Unanswered (Auto-retry queued)",
    score: 5,
    timeAgo: "Yesterday",
    timestamp: "Yesterday, 2:20 PM",
    persona: "Alex (Consultative)",
    bant: {
      budget: 5,
      authority: 5,
      need: 6,
      timing: 5,
      summary: "Line busy after 4 rings. Auto-retry schedule set for 24 hours later.",
    },
    transcript: [
      { speaker: "agent", time: "0:01", text: "[Outgoing dialing tone... User line unanswered after 30 seconds]." },
    ],
  },
];

export default function AICallingPage() {
  const [callLogs, setCallLogs] = useState<DummyCallRecord[]>(INITIAL_CALL_LOGS);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("Alex (Consultative)");
  const [callGoal, setCallGoal] = useState("BANT Qualification & Demo");
  const [isSimulatingCall, setIsSimulatingCall] = useState(false);

  // Settings mock state
  const [autoCallHighIntent, setAutoCallHighIntent] = useState(true);
  const [inboundReceptionist, setInboundReceptionist] = useState(true);
  const [voicemailDrop, setVoicemailDrop] = useState(true);
  const [calendarSync, setCalendarSync] = useState(true);
  const [minScoreThreshold, setMinScoreThreshold] = useState("7");

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "booked" | "completed" | "voicemail" | "no_answer">("all");

  // Selected Call Modal
  const [selectedCall, setSelectedCall] = useState<DummyCallRecord | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Derived mock metrics
  const totalCalls = callLogs.length + 142; // realistic mock base
  const bookedCalls = callLogs.filter((c) => c.status === "booked").length + 39;
  const connectionRate = "74.2%";
  const avgDuration = "2m 48s";

  const filteredLogs = callLogs.filter((call) => {
    const matchesSearch =
      call.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.phone.includes(searchQuery) ||
      call.company.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSimulateCall = () => {
    if (!manualName.trim() || !manualPhone.trim()) {
      toast.error("Please enter both prospect name and phone number");
      return;
    }

    setIsSimulatingCall(true);
    toast.info(`Dialing ${manualName.trim()} (${manualPhone.trim()})...`, {
      description: `Persona: ${selectedPersona} · Objective: ${callGoal}`,
    });

    setTimeout(() => {
      setIsSimulatingCall(false);

      const newRecord: DummyCallRecord = {
        id: `call_${Date.now()}`,
        leadName: manualName.trim(),
        phone: manualPhone.trim(),
        company: manualCompany.trim() || "Independent Prospect",
        status: "booked",
        duration: "3m 10s",
        durationSeconds: 190,
        outcome: "Appointment Booked (Demo Mode)",
        score: 9,
        timeAgo: "Just now",
        timestamp: "Just now",
        persona: selectedPersona,
        bant: {
          budget: 9,
          authority: 9,
          need: 9,
          timing: 9,
          summary: `Simulated qualification call dispatched. Prospect verified interest in automated social scheduling and confirmed 15-min consultation.`,
        },
        transcript: [
          { speaker: "agent", time: "0:02", text: `Hi ${manualName.trim()}! This is ${selectedPersona.split(" ")[0]} from Lemon AI. I noticed your interest in our growth platform.` },
          { speaker: "prospect", time: "0:12", text: "Hey! Yes, I was checking out your automated AI social media flywheel and CRM integration." },
          { speaker: "agent", time: "0:25", text: "Terrific! It automates trend scraping, post creation, multi-platform publishing, and qualifies inbound leads automatically." },
          { speaker: "prospect", time: "0:42", text: "That sounds ideal for what we need. Let's schedule a discovery demo." },
          { speaker: "agent", time: "0:55", text: "Done! Calendar invite and confirmation have been dispatched to your number." },
        ],
      };

      setCallLogs([newRecord, ...callLogs]);
      setManualName("");
      setManualPhone("");
      setManualCompany("");

      toast.success(`🎉 Simulated Call Completed with ${newRecord.leadName}!`, {
        description: `Outcome: Appointment Booked · BANT Score: 9/10`,
      });
    }, 1800);
  };

  const handleResetSampleData = () => {
    setCallLogs(INITIAL_CALL_LOGS);
    setSearchQuery("");
    setStatusFilter("all");
    toast.success("Call log records reset to sample data");
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-3 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Phone className="size-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">AI Voice Calling Agent</h1>
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800">
              Interactive Preview Mode
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Simulate, test, and audit autonomous voice qualification, BANT scoring, and live call transcripts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetSampleData}
            className="gap-2 text-xs"
          >
            <RotateCcw className="size-3.5" />
            Reset Sample Calls
          </Button>
        </div>
      </div>

      {/* Hero Overview Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-purple-500/5 to-transparent">
        <CardContent className="pt-4 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                Autonomous Inbound & Outbound Calling System
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                When high-intent leads score ≥ 7 from Instagram DMs, Facebook comments, or web forms, your AI voice agent can automatically call them within 90 seconds to qualify budget, need, and lock consultations directly on Cal.com.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
              ● Voice Engine Ready
            </Badge>
            <Badge variant="outline" className="text-xs">
              Latency: &lt;580ms
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Phone className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{totalCalls}</p>
              <p className="text-xs text-muted-foreground">Total Dispatched</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-500/10 text-green-500">
              <CalendarCheck className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{bookedCalls}</p>
              <p className="text-xs text-muted-foreground">Meetings Booked</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-500">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{avgDuration}</p>
              <p className="text-xs text-muted-foreground">Avg Call Duration</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{connectionRate}</p>
              <p className="text-xs text-muted-foreground">Connection Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Manual Call Simulator */}
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <PhoneCall className="size-4 text-primary" /> Test Voice Dispatch
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                Simulator
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Simulate an immediate AI voice qualification call to any number
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Lead / Prospect Name *</Label>
              <Input
                placeholder="e.g. Aarav Sharma"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone Number *</Label>
              <Input
                placeholder="+91 98765 43210"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company (Optional)</Label>
              <Input
                placeholder="e.g. Apex Global"
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AI Voice Persona</Label>
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Alex (Consultative)">Alex — Consultative, Calm & Professional</option>
                <option value="Sarah (Energetic)">Sarah — High-Energy, Direct & Enthusiastic</option>
                <option value="David (Executive)">David — Concise, High-Ticket Executive</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Call Goal</Label>
              <select
                value={callGoal}
                onChange={(e) => setCallGoal(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="BANT Qualification & Demo">BANT Qualification & 15-min Demo</option>
                <option value="Lead Reactivation">Cold / Unresponsive Lead Reactivation</option>
                <option value="VIP Consultation Lock">High-Ticket VIP Consultation Lock</option>
              </select>
            </div>

            <Button
              className="w-full gap-2 mt-2"
              disabled={isSimulatingCall || !manualName.trim() || !manualPhone.trim()}
              onClick={handleSimulateCall}
            >
              {isSimulatingCall ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Dialing Prospect...
                </>
              ) : (
                <>
                  <PhoneCall className="size-4" />
                  Dispatch Call (AI Voice)
                </>
              )}
            </Button>

            <p className="text-[11px] text-center text-muted-foreground pt-1">
              Interactive test call simulates speech synthesis, BANT scoring, and live transcripts.
            </p>
          </CardContent>
        </Card>

        {/* Right: Autonomous Calling Rules & Configuration */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="size-4 text-primary" /> Autonomous Calling Rules & Triggers
              </CardTitle>
              <Badge variant="outline" className="text-xs font-mono">
                Provider: External Custom
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Configure automatic calling triggers for incoming CRM inquiries and social leads
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  Auto-Call High-Intent Leads (Score ≥ {minScoreThreshold})
                </p>
                <p className="text-xs text-muted-foreground">
                  Automatically triggers an outbound qualification call within 90 seconds of form or DM submission
                </p>
              </div>
              <Switch
                checked={autoCallHighIntent}
                onCheckedChange={(checked) => {
                  setAutoCallHighIntent(checked);
                  toast.success(
                    checked
                      ? "Auto-Calling activated for high-intent leads (Score ≥ 7)!"
                      : "Auto-Calling paused. Leads will remain queued for manual review."
                  );
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Inbound AI Receptionist</p>
                <p className="text-xs text-muted-foreground">
                  Answers incoming business calls, answers brand FAQs, and logs caller details directly into CRM
                </p>
              </div>
              <Switch
                checked={inboundReceptionist}
                onCheckedChange={(checked) => {
                  setInboundReceptionist(checked);
                  toast.success(
                    checked ? "Inbound AI Receptionist online." : "Inbound Receptionist disabled."
                  );
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Smart Voicemail Drop & WhatsApp Follow-up</p>
                <p className="text-xs text-muted-foreground">
                  If the prospect line is busy or goes to voicemail, drop a tailored audio note and send booking URL via WhatsApp
                </p>
              </div>
              <Switch
                checked={voicemailDrop}
                onCheckedChange={(checked) => {
                  setVoicemailDrop(checked);
                  toast.success(
                    checked ? "Voicemail drop enabled." : "Voicemail drop disabled."
                  );
                }}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Cal.com & Google Calendar Instant Lock</p>
                <p className="text-xs text-muted-foreground">
                  Voice agent accesses real-time calendar availability and reserves slots during the live telephone conversation
                </p>
              </div>
              <Switch
                checked={calendarSync}
                onCheckedChange={(checked) => {
                  setCalendarSync(checked);
                  toast.success(
                    checked ? "Real-time calendar booking synced." : "Calendar booking disabled."
                  );
                }}
              />
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  Minimum BANT Intent Score to Trigger Auto-Call:
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[6, 7, 8, 9].map((score) => (
                  <Button
                    key={score}
                    size="sm"
                    variant={minScoreThreshold === String(score) ? "default" : "outline"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setMinScoreThreshold(String(score));
                      toast.success(`Auto-call minimum intent threshold set to ${score}/10`);
                    }}
                  >
                    ≥ {score}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Activity Records & Transcripts */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Voice Call Activity & Transcripts
              </CardTitle>
              <CardDescription className="text-xs">
                Review call recordings, qualification scores, and interactive transcripts
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative w-48 sm:w-60">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search lead or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs h-8 pl-8"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border text-xs">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "booked", label: "Booked" },
                    { key: "completed", label: "Qualified" },
                    { key: "voicemail", label: "Voicemail" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                      statusFilter === tab.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed rounded-xl">
              <Bot className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">No call records found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery
                  ? "No calls match your search query. Try clearing filters."
                  : "Dispatch a simulated call using the panel above to see it appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((call) => {
                const isBooked = call.status === "booked";
                const isVoicemail = call.status === "voicemail";
                const isNoAnswer = call.status === "no_answer";

                return (
                  <div
                    key={call.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border hover:bg-muted/20 transition-all gap-3 group"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div
                        className={`size-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                          isBooked
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-800"
                            : isVoicemail
                            ? "bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-800"
                            : isNoAnswer
                            ? "bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-800"
                            : "bg-blue-500/10 text-blue-600 border border-blue-200 dark:border-blue-800"
                        }`}
                      >
                        {isBooked ? "📅" : isVoicemail ? "📱" : isNoAnswer ? "❌" : "📞"}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{call.leadName}</p>
                          <span className="text-xs text-muted-foreground font-mono">
                            {call.phone}
                          </span>
                          {call.company && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              {call.company}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{call.outcome}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="size-3" /> {call.duration}
                          </span>
                          <span>•</span>
                          <span>{call.timeAgo}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                      <div className="text-right hidden sm:block">
                        <Badge
                          variant="secondary"
                          className={`text-xs font-medium ${
                            call.score >= 8
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                              : "bg-blue-500/10 text-blue-600 border-blue-200"
                          }`}
                        >
                          BANT: {call.score}/10
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{call.persona}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs hover:bg-primary hover:text-primary-foreground transition-all"
                        onClick={() => {
                          setSelectedCall(call);
                          setIsPlayingAudio(false);
                        }}
                      >
                        <FileText className="size-3.5" />
                        Transcript & Audio
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript & Audio Dialog Modal */}
      <Dialog open={Boolean(selectedCall)} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCall && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg flex items-center gap-2">
                    <Headphones className="size-5 text-primary" /> Call Audit: {selectedCall.leadName}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200"
                  >
                    {selectedCall.outcome}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  {selectedCall.company} · {selectedCall.phone} · {selectedCall.timestamp} · Persona: {selectedCall.persona}
                </DialogDescription>
              </DialogHeader>

              {/* Simulated Audio Wave Player */}
              <div className="p-3.5 rounded-xl bg-muted/40 border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="default"
                      className="size-8 rounded-full"
                      onClick={() => {
                        setIsPlayingAudio(!isPlayingAudio);
                        toast.info(
                          isPlayingAudio ? "Simulated audio paused" : "Playing simulated call recording..."
                        );
                      }}
                    >
                      {isPlayingAudio ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
                    </Button>
                    <div>
                      <p className="text-xs font-semibold">AI Call Recording Audio</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {isPlayingAudio ? "0:42" : "0:00"} / {selectedCall.duration}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Volume2 className="size-4 text-primary" />
                    <span>HD 24kHz Opus</span>
                  </div>
                </div>

                {/* Animated Waveform Visualizer */}
                <div className="flex items-center gap-1 h-8 pt-1">
                  {[40, 65, 85, 30, 95, 45, 75, 100, 60, 35, 80, 50, 90, 70, 45, 85, 60, 30, 75, 90, 65, 40, 80, 55, 30, 70].map(
                    (height, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          isPlayingAudio
                            ? "bg-primary animate-pulse"
                            : "bg-muted-foreground/30"
                        }`}
                        style={{
                          height: isPlayingAudio ? `${Math.max(20, (height * (idx % 3 + 1)) % 100)}%` : `${height * 0.4}%`,
                        }}
                      />
                    )
                  )}
                </div>
              </div>

              {/* BANT Evaluation Breakdown */}
              <div className="p-3.5 rounded-xl border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Target className="size-4 text-primary" /> BANT Intent Qualification
                  </p>
                  <Badge variant="secondary" className="text-xs font-bold">
                    Score: {selectedCall.score}/10
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2 rounded-lg bg-muted/30 border">
                    <p className="text-[10px] text-muted-foreground">Budget</p>
                    <p className="text-sm font-bold text-emerald-600">{selectedCall.bant.budget}/10</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border">
                    <p className="text-[10px] text-muted-foreground">Authority</p>
                    <p className="text-sm font-bold text-blue-600">{selectedCall.bant.authority}/10</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border">
                    <p className="text-[10px] text-muted-foreground">Need</p>
                    <p className="text-sm font-bold text-purple-600">{selectedCall.bant.need}/10</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border">
                    <p className="text-[10px] text-muted-foreground">Timing</p>
                    <p className="text-sm font-bold text-amber-600">{selectedCall.bant.timing}/10</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-1 italic">
                  "{selectedCall.bant.summary}"
                </p>
              </div>

              {/* Turn-by-turn Transcript */}
              <div className="space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Bot className="size-4 text-primary" /> Dialogue Transcript
                </p>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedCall.transcript.map((msg, index) => {
                    const isAgent = msg.speaker === "agent";
                    return (
                      <div
                        key={index}
                        className={`flex flex-col text-xs p-2.5 rounded-xl ${
                          isAgent
                            ? "bg-primary/10 border border-primary/20 text-foreground ml-4"
                            : "bg-muted border text-foreground mr-4"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span className="font-semibold text-foreground">
                            {isAgent ? `🤖 AI Voice Agent (${selectedCall.persona.split(" ")[0]})` : `👤 ${selectedCall.leadName}`}
                          </span>
                          <span className="font-mono">{msg.time}</span>
                        </div>
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
