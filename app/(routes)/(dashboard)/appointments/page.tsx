"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarClock,
  ExternalLink,
  CheckCircle,
  Save,
  Sparkles,
  Check,
  Database,
  Loader2,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  Search,
  MessageSquare,
  DollarSign,
  Copy,
  CalendarDays,
  Bot,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Lead } from "@/lib/crm-service";

interface BookingTool {
  name: string;
  description: string;
  link: string;
  badge: string;
  badgeColor: string;
  steps: string[];
}

const BOOKING_TOOLS: BookingTool[] = [
  {
    name: "Cal.com",
    description: "Open source, flexible calendar scheduling. Recommended for modern businesses.",
    link: "https://cal.com",
    badge: "Recommended",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900",
    steps: [
      "Sign up or log in at cal.com",
      "Create an event type (e.g. '30-Min Discovery Consultation')",
      "Copy your public booking link (e.g. https://cal.com/yourbrand/call)",
      "Save the link below — Lemon AI bots will share it automatically",
    ],
  },
  {
    name: "Calendly",
    description: "Widely used scheduling platform with instant calendar sync.",
    link: "https://calendly.com",
    badge: "Popular",
    badgeColor: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900",
    steps: [
      "Sign up or log in at calendly.com",
      "Create an event type (e.g. '15-Min Strategy Session')",
      "Copy your scheduling URL",
      "Paste below and save to database",
    ],
  },
  {
    name: "Google Calendar",
    description: "Native Google Workspace appointment schedules without extra software.",
    link: "https://calendar.google.com",
    badge: "Free Native",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900",
    steps: [
      "Open Google Calendar on desktop",
      "Click '+ Create' → Appointment schedule",
      "Set your availability and copy the booking page link",
      "Paste below and save to database",
    ],
  },
];

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookingLinks, setBookingLinks] = useState<Record<string, string>>({
    "Cal.com": "",
    "Calendly": "",
    "Google Calendar": "",
  });
  const [savedTool, setSavedTool] = useState<string | null>(null);

  // 1. Fetch CRM Leads & Booked Appointments
  const {
    data: crmData,
    isLoading: isLeadsLoading,
    refetch: refetchLeads,
    isRefetching,
  } = useQuery({
    queryKey: ["crm-leads-appointments"],
    queryFn: async () => {
      const res = await fetch("/api/crm/leads");
      if (!res.ok) throw new Error("Failed to load appointments");
      return res.json();
    },
    refetchInterval: 5000, // real-time poll for freshly booked appointments
  });

  // Extract all leads that have appointments
  const allLeads: Lead[] = crmData?.leads || [];
  const bookedAppointments = allLeads.filter(
    (l) =>
      l.stage === "booked" ||
      Boolean(l.metadata?.bookingInfo?.scheduledAt) ||
      Boolean(l.metadata?.bookingInfo?.dateText)
  );

  const filteredAppointments = bookedAppointments.filter((l) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(term)) ||
      (l.email && l.email.toLowerCase().includes(term)) ||
      (l.phone && l.phone.includes(term)) ||
      (l.metadata?.bookingInfo?.dateText &&
        l.metadata.bookingInfo.dateText.toLowerCase().includes(term))
    );
  });

  // 2. Fetch verified brand profile from database
  const { data: brandData } = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) throw new Error("Failed to load brand profile");
      return res.json();
    },
  });

  const activeProfile = brandData?.profile;
  const dbBookingUrl = activeProfile?.booking_url || "";

  useEffect(() => {
    if (dbBookingUrl) {
      if (dbBookingUrl.includes("cal.com")) {
        setBookingLinks((prev) => ({ ...prev, "Cal.com": dbBookingUrl }));
      } else if (dbBookingUrl.includes("calendly")) {
        setBookingLinks((prev) => ({ ...prev, "Calendly": dbBookingUrl }));
      } else if (dbBookingUrl.includes("calendar.google")) {
        setBookingLinks((prev) => ({ ...prev, "Google Calendar": dbBookingUrl }));
      } else {
        setBookingLinks((prev) => ({ ...prev, "Cal.com": dbBookingUrl }));
      }
    }
  }, [dbBookingUrl]);

  // Database Save Mutation
  const saveMutation = useMutation({
    mutationFn: async ({ toolName, url }: { toolName: string; url: string }) => {
      const payload = {
        ...(activeProfile || {}),
        business_name: activeProfile?.business_name || "My Business",
        niche: activeProfile?.niche || "Professional Services",
        target_audience: activeProfile?.target_audience || "Valued Clients",
        booking_url: url.trim(),
      };

      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save booking link");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      setSavedTool(vars.toolName);
      setTimeout(() => setSavedTool(null), 2500);
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
      toast.success(`${vars.toolName} link synced to Server & Database! AI bots will now share this link.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save link to database");
    },
  });

  const handleSave = (toolName: string) => {
    const url = bookingLinks[toolName];
    if (!url?.trim()) return;
    saveMutation.mutate({ toolName, url });
  };

  const copyDetails = (lead: Lead) => {
    const bInfo = lead.metadata?.bookingInfo || {};
    const text = `Appointment with ${lead.name || "Prospect"}\nDate/Time: ${bInfo.dateText || bInfo.scheduledAt || "Upcoming"}\nEmail: ${lead.email || "N/A"}\nPhone: ${lead.phone || "N/A"}\nSource: ${bInfo.bookingSource || lead.source}`;
    navigator.clipboard.writeText(text);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Appointment details copied to clipboard!");
  };

  const totalPipelineValue = bookedAppointments.reduce(
    (sum, l) => sum + (Number(l.deal_value) || 5000),
    0
  );

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="size-6 text-primary" /> CRM Appointments & Scheduling Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review meetings booked autonomously by your AI Chatbot, configure available slots, and manage calendar integrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchLeads()}
            disabled={isRefetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Link href="/crm/pipeline">
            <Button size="sm" className="text-xs gap-1.5">
              Open Pipeline Kanban <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Booked Appointments</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{bookedAppointments.length}</p>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CalendarDays className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/15">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">AI Bot Bookings</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {bookedAppointments.filter((l) => l.metadata?.bookingInfo?.bookingSource?.includes("chatbot") || l.source === "website").length}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Bot className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-blue-500/20 bg-blue-50/20 dark:bg-blue-950/15">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pipeline Value</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                ${totalPipelineValue.toLocaleString()}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <DollarSign className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-purple-500/20 bg-purple-50/20 dark:bg-purple-950/15">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Calendar Status</p>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mt-1 truncate max-w-[140px]">
                {dbBookingUrl ? "● Active in AI" : "Setup Required"}
              </p>
            </div>
            <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Database className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="appointments" className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="appointments" className="text-xs">
            Appointments ({bookedAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="slots" className="text-xs">
            Slot Rules
          </TabsTrigger>
          <TabsTrigger value="calendar-links" className="text-xs">
            Calendar Links
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BOOKED APPOINTMENTS */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Link href="/website-bot">
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <Bot className="size-3.5" /> Test Chatbot Booking
                </Button>
              </Link>
            </div>
          </div>

          {isLeadsLoading ? (
            <Card>
              <CardContent className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading CRM appointments...</p>
              </CardContent>
            </Card>
          ) : filteredAppointments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <CalendarClock className="size-6" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-semibold text-foreground">No appointments booked yet</h3>
                  <p className="text-xs text-muted-foreground">
                    When visitors chat with your AI Chatbot and schedule a meeting (e.g. &quot;book my appointment 18th Sept 7pm&quot;), their appointment will automatically show up here and in your CRM pipeline!
                  </p>
                </div>
                <Link href="/website-bot">
                  <Button size="sm" className="text-xs gap-1.5 mt-2">
                    <Sparkles className="size-3.5" /> Open Website Bot to Test
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAppointments.map((lead) => {
                const bInfo = lead.metadata?.bookingInfo || {};
                const dateDisplay =
                  bInfo.dateText ||
                  (bInfo.scheduledAt ? new Date(bInfo.scheduledAt).toLocaleString() : "Date requested in chat");

                return (
                  <Card key={lead.id} className="shadow-xs hover:shadow-md transition-shadow border-border/80">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                            <User className="size-4 text-primary" />
                            {lead.name || "Valued Prospect"}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                            <span>Stage:</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-600 border-purple-200">
                              Appointment Booked
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Score: {lead.score}/10
                            </Badge>
                          </CardDescription>
                        </div>
                        <Badge className="bg-emerald-500 text-white text-[10px] gap-1 px-2 py-0.5">
                          <CheckCircle className="size-3" /> Confirmed
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0 text-xs">
                      {/* Scheduled Time Banner */}
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <Clock className="size-4 text-primary shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">Scheduled Time</p>
                          <p className="text-xs text-primary font-medium">{dateDisplay}</p>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1 text-muted-foreground">
                        {lead.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-[11px] text-foreground">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="size-3.5 text-muted-foreground shrink-0" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
                          <span>Source: {bInfo.bookingSource || lead.source || "Website Chatbot"}</span>
                        </div>
                      </div>

                      {/* Notes / Topic */}
                      {bInfo.notes && (
                        <p className="text-[11px] bg-muted/40 p-2 rounded border text-muted-foreground italic">
                          &quot;{bInfo.notes}&quot;
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1 font-semibold text-foreground">
                          <DollarSign className="size-3.5 text-muted-foreground -mr-1" />
                          <span>{Number(lead.deal_value) || 5000} Potential Deal</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyDetails(lead)}
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            {copiedId === lead.id ? (
                              <>
                                <Check className="size-3 text-emerald-500" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" /> Copy
                              </>
                            )}
                          </Button>
                          <Link href="/crm/pipeline">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1">
                              View in Pipeline <ArrowRight className="size-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: AI SLOT CONCIERGE RULES */}
        <TabsContent value="slots" className="space-y-4">
          <Card className="border-primary/20 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Autonomous Chatbot Slot Rules
              </CardTitle>
              <CardDescription className="text-xs">
                How your AI Chatbot responds when website visitors ask for available consultation slots or meeting times.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-1.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" /> Operating Working Days
                  </p>
                  <p className="text-muted-foreground">Monday through Saturday (6 days a week)</p>
                </div>
                <div className="p-3.5 rounded-lg border bg-muted/20 space-y-1.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary" /> Business Hours
                  </p>
                  <p className="text-muted-foreground">10:00 AM – 7:00 PM (Local / Regional Time)</p>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                <p className="font-semibold text-foreground">Standard 30-Min Consultation Slots Offered by AI:</p>
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

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Bot className="size-4 text-primary" /> How the AI Chatbot Handles Slots in Conversation:
                </p>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  <li><strong>Visitor asks:</strong> &quot;What slots are available?&quot; or &quot;When can we meet?&quot;</li>
                  <li><strong>Bot responds:</strong> Lists the morning, afternoon, and evening slots, and invites the visitor to select a preferred day and time.</li>
                  <li><strong>Visitor specifies:</strong> &quot;Book my appointment Bhavya Chaturvedi 18th September 7pm&quot;</li>
                  <li><strong>Bot confirms:</strong> Records the appointment instantly into the CRM database with stage: <span className="font-mono text-primary font-medium">booked</span> and asks for email to send the calendar invite!</li>
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <Link href="/website-bot">
                  <Button size="sm" className="text-xs gap-1.5">
                    <Sparkles className="size-3.5" /> Test Slot Booking Live in Chatbot
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CALENDAR INTEGRATIONS */}
        <TabsContent value="calendar-links" className="space-y-4">
          {/* Active Database Booking Status */}
          <Card className="border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/15 shadow-xs">
            <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <Database className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    Server-Synced Calendar Booking URL
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dbBookingUrl ? (
                      <span className="font-mono text-foreground font-medium">{dbBookingUrl}</span>
                    ) : (
                      "No external booking URL saved yet. Save one below to arm your AI bots."
                    )}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  dbBookingUrl
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                    : "bg-muted text-muted-foreground"
                }
              >
                {dbBookingUrl ? "● Active in AI Bots" : "Action Required"}
              </Badge>
            </CardContent>
          </Card>

          {/* Tools list */}
          <div className="space-y-4">
            {BOOKING_TOOLS.map((tool) => (
              <Card key={tool.name} className="shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      {tool.name}
                    </CardTitle>
                    <Badge variant="outline" className={`text-xs font-medium ${tool.badgeColor}`}>
                      {tool.badge}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-1.5 bg-muted/30 p-3 rounded-lg border">
                    {tool.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Your {tool.name} Public Booking URL
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={`https://${tool.name.toLowerCase().replace(/[^a-z]/g, "")}/your-name/booking`}
                        value={bookingLinks[tool.name] || ""}
                        onChange={(e) =>
                          setBookingLinks((prev) => ({ ...prev, [tool.name]: e.target.value }))
                        }
                        className="text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSave(tool.name)}
                        disabled={!bookingLinks[tool.name]?.trim() || saveMutation.isPending}
                        className="text-xs gap-1.5 shrink-0"
                      >
                        {saveMutation.isPending && savedTool === tool.name ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Saving...
                          </>
                        ) : savedTool === tool.name ? (
                          <>
                            <Check className="size-3.5 text-emerald-300" /> Saved!
                          </>
                        ) : (
                          <>
                            <Save className="size-3.5" /> Save to Database
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Link href={tool.link} target="_blank">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" /> Open {tool.name} Dashboard
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
