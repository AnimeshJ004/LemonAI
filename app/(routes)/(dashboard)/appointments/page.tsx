"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarClock, ExternalLink, CheckCircle, Save, Sparkles, Check } from "lucide-react";
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
      "Save the link below for Lemon AI bots to share",
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
      "Paste below and save",
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
      "Paste below and save",
    ],
  },
];

export default function AppointmentsPage() {
  const [bookingLinks, setBookingLinks] = useState<Record<string, string>>({
    "Cal.com": "",
    "Calendly": "",
    "Google Calendar": "",
  });
  const [savedTool, setSavedTool] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lemon_booking_links");
    if (saved) {
      try {
        setBookingLinks(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const handleSave = (toolName: string) => {
    const updated = { ...bookingLinks };
    localStorage.setItem("lemon_booking_links", JSON.stringify(updated));
    setSavedTool(toolName);
    setTimeout(() => setSavedTool(null), 2500);
    toast.success(`${toolName} link saved! Lemon AI will now share this with qualified leads.`);
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

      {/* How AI works banner */}
      <Card className="border-primary/20 bg-primary/5 shadow-xs">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">How Lemon AI Uses Your Scheduling Links</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Whenever a customer expresses interest in your offer across any touchpoint, our AI assistants seamlessly guide them toward scheduling a meeting using your verified booking link.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {[
              "Website Chatbot upon high purchase intent",
              "WhatsApp sales bot after customer qualification",
              "Instagram & Facebook DM lead follow-ups",
              "Automated email & CRM recovery workflows",
            ].map((channel, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-foreground/90">
                <span className="text-primary font-bold">✓</span> {channel}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Booking Providers List */}
      <div className="space-y-4">
        {BOOKING_TOOLS.map((tool) => (
          <Card key={tool.name} className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">{tool.name}</CardTitle>
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
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSave(tool.name)}
                    disabled={!bookingLinks[tool.name]?.trim()}
                    className="text-xs gap-1.5 shrink-0"
                  >
                    {savedTool === tool.name ? (
                      <>
                        <Check className="size-3.5 text-emerald-300" /> Saved!
                      </>
                    ) : (
                      <>
                        <Save className="size-3.5" /> Save Link
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
