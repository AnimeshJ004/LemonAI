"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, ExternalLink, CheckCircle, Save, Sparkles, Check, Database, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
  const [bookingLinks, setBookingLinks] = useState<Record<string, string>>({
    "Cal.com": "",
    "Calendly": "",
    "Google Calendar": "",
  });
  const [savedTool, setSavedTool] = useState<string | null>(null);

  // Fetch verified brand profile from database
  const { data: brandData, isLoading } = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) throw new Error("Failed to load brand profile");
      return res.json();
    },
  });

  const activeProfile = brandData?.profile;
  const dbBookingUrl = activeProfile?.booking_url || "";

  // Initialize from database URL if available
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

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="size-6 text-primary" /> Autonomous Appointment Booking
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your calendar so AI agents can automatically share your booking link with qualified leads 24/7
        </p>
      </div>

      {/* Active Database Booking Status */}
      <Card className="border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/15 shadow-xs">
        <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Database className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                Server-Synced Booking Link Status
              </p>
              <p className="text-xs text-muted-foreground">
                {dbBookingUrl ? (
                  <span className="font-mono text-foreground font-medium">{dbBookingUrl}</span>
                ) : (
                  "No booking URL saved to database yet. Save one below to arm the AI bots."
                )}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={dbBookingUrl ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" : "bg-muted text-muted-foreground"}>
            {dbBookingUrl ? "● Active in AI Bots" : "Action Required"}
          </Badge>
        </CardContent>
      </Card>

      {/* How AI works banner */}
      <Card className="border-primary/20 bg-primary/5 shadow-xs">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">How Lemon AI Uses Your Scheduling Links</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Whenever a customer expresses interest in your offer across any touchpoint, our AI assistants seamlessly guide them toward scheduling a meeting using your verified booking link stored in the Business Brain.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {[
              "Website Chatbot upon high purchase intent",
              "WhatsApp Bot for qualified customer inquiries",
              "Instagram & Facebook DM automation bot",
              "AI Voice Calling Agent SMS / follow-up handoff",
            ].map((pt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                <Check className="size-3.5 text-primary shrink-0" />
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tools list */}
      <div className="space-y-4">
        {BOOKING_TOOLS.map((tool) => (
          <Card key={tool.name} className="shadow-sm">
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
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-3.5" /> Open {tool.name} Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
