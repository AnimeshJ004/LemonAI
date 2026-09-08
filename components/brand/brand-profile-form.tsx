"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Building2,
  Users,
  Megaphone,
  Gift,
  Link2,
  Save,
  Check,
  Loader2,
  Sparkles,
  ChevronRight,
  Briefcase,
  ShieldCheck,
  Calendar,
  Clock,
  Sliders,
  Send,
  CheckCircle2,
  Image as ImageIcon,
  ExternalLink,
  Layers,
  Sparkle,
  RotateCcw,
  BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BrandProfile {
  id?: string;
  business_name: string;
  niche: string;
  target_audience: string;
  brand_tone: string;
  mainOffer?: string; // alias
  main_offer: string;
  competitors: string;
  products_services?: string;
  pricing_details?: string;
  knowledge_docs?: string;
  location?: string;
  booking_url?: string;
  auto_call_enabled?: boolean;
  auto_call_min_score?: number;
}

interface ChannelItem {
  id: string;
  type: string;
  name: string;
  color: string;
  character_limit: number;
  user_channel_id: string | null;
  connected: boolean;
  handle: string | null;
}

const BRAND_TONES = [
  { value: "Professional", label: "Professional" },
  { value: "Friendly", label: "Friendly" },
  { value: "Bold", label: "Bold" },
  { value: "Luxury", label: "Luxury" },
  { value: "Energetic", label: "Energetic" },
];

const PRESET_DAYS = [
  { value: 3, label: "3 Days", sub: "Quick Sprint" },
  { value: 7, label: "7 Days", sub: "1 Week (Best)" },
  { value: 14, label: "14 Days", sub: "2 Weeks" },
  { value: 30, label: "30 Days", sub: "Full Month" },
];

const PRESET_POSTS_PER_DAY = [
  { value: 1, label: "1 / Day", desc: "Steady Base" },
  { value: 2, label: "2 / Day", desc: "Optimal Growth" },
  { value: 3, label: "3 / Day", desc: "High Engagement" },
  { value: 4, label: "4 / Day", desc: "Aggressive Blitz" },
];

const DEFAULT_TIME_SLOTS: Record<number, string[]> = {
  1: ["10:00"],
  2: ["09:30", "16:30"],
  3: ["09:00", "14:00", "19:30"],
  4: ["08:30", "12:30", "17:00", "20:30"],
};

function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return "";
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  let hour = parseInt(match[1], 10);
  const min = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour.toString().padStart(2, "0")}:${min} ${ampm}`;
}

const EMPTY_PROFILE: BrandProfile = {
  business_name: "",
  niche: "",
  target_audience: "",
  brand_tone: "Professional",
  main_offer: "",
  competitors: "",
  products_services: "",
  pricing_details: "",
  knowledge_docs: "",
  location: "India & Global",
  booking_url: "",
  auto_call_enabled: false,
  auto_call_min_score: 7,
};

// ─── Field Config ─────────────────────────────────────────────────────────────
const FIELD_ICONS: Record<string, React.ElementType> = {
  business_name: Building2,
  niche: Sparkles,
  target_audience: Users,
  brand_tone: Megaphone,
  main_offer: Gift,
  competitors: Link2,
  products_services: Briefcase,
  pricing_details: Clock,
  knowledge_docs: BookOpen,
  location: Building2,
  booking_url: Link2,
};

export function BrandProfileForm() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const queryClient = useQueryClient();

  // Form State
  const [form, setForm] = useState<BrandProfile>(EMPTY_PROFILE);
  const [isInit, setIsInit] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // AI Scheduling Filter State
  const [days, setDays] = useState<number>(7);
  const [postsPerDay, setPostsPerDay] = useState<number>(2);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [generateImages, setGenerateImages] = useState<boolean>(true);
  const [postStatus, setPostStatus] = useState<"queue" | "draft">("queue");

  // Result state
  const [scheduleResult, setScheduleResult] = useState<any | null>(null);
  const [scheduleProgress, setScheduleProgress] = useState<string>("");

  const storageKey = user?.id ? `lemon_ai_brand_profile_${user.id}` : null;

  useEffect(() => {
    setIsMounted(true);
    try {
      localStorage.removeItem("lemon_ai_brand_profile");
    } catch {}
  }, []);

  // Sync from user-specific local storage
  useEffect(() => {
    if (!isUserLoaded) return;
    if (!storageKey) {
      setForm(EMPTY_PROFILE);
      return;
    }
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.business_name) {
          setForm(parsed);
          setIsInit(true);
        }
      } else {
        setForm(EMPTY_PROFILE);
      }
    } catch {}
  }, [isUserLoaded, storageKey]);

  // Fetch existing profile from server
  const { isLoading: isProfileLoading, data } = useQuery({
    queryKey: ["brand-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) throw new Error("Failed to fetch brand profile");
      return res.json() as Promise<{ profile: BrandProfile | null; tableExists: boolean }>;
    },
  });

  // Fetch available / connected channels
  const { data: channelsData } = useQuery({
    queryKey: ["channels", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await fetch("/api/channel");
      if (!res.ok) return { channels: [] as ChannelItem[] };
      return res.json() as Promise<{ channels: ChannelItem[]; connectedCount: number }>;
    },
  });

  const channels: ChannelItem[] = channelsData?.channels || [];

  // Sync form from server profile or cache
  useEffect(() => {
    if (data?.profile) {
      const loadedProfile: BrandProfile = {
        business_name: data.profile.business_name ?? "",
        niche: data.profile.niche ?? "",
        target_audience: data.profile.target_audience ?? "",
        brand_tone: data.profile.brand_tone ?? "Professional",
        main_offer: data.profile.main_offer ?? "",
        competitors: data.profile.competitors ?? "",
      };
      setForm(loadedProfile);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(loadedProfile));
        } catch {}
      }
      setIsInit(true);
    } else if (data && !data.profile && storageKey) {
      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.business_name) {
            setForm(parsed);
            setIsInit(true);
          }
        }
      } catch {}
    }
  }, [data, storageKey]);

  const set = useCallback(
    <K extends keyof BrandProfile>(key: K, val: BrandProfile[K]) => {
      setForm((prev) => {
        const updated = { ...prev, [key]: val };
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    },
    [storageKey]
  );

  // Toggle channel selection
  const toggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const selectAllChannels = () => {
    if (selectedChannelIds.length === channels.length) {
      setSelectedChannelIds([]);
    } else {
      setSelectedChannelIds(channels.map((c) => c.id));
    }
  };

  // Calculations
  const totalPostsToSchedule = days * postsPerDay;

  const dateRangePreview = useMemo(() => {
    const now = new Date();
    const start = now;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (days - 1));
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `Today (${start.toLocaleDateString("en-US", opts)}) – ${end.toLocaleDateString("en-US", opts)}`;
  }, [days]);

  // User customizable time slots (HH:mm format)
  const [customTimes, setCustomTimes] = useState<string[]>(["09:30", "16:30"]);

  // Keep customTimes synced when postsPerDay changes
  useEffect(() => {
    setCustomTimes((prev) => {
      const defaults = DEFAULT_TIME_SLOTS[postsPerDay] || ["10:00"];
      const next: string[] = [];
      for (let i = 0; i < postsPerDay; i++) {
        next.push(prev[i] || defaults[i] || "10:00");
      }
      return next;
    });
  }, [postsPerDay]);

  const updateTimeSlot = (index: number, newTime: string) => {
    if (!newTime) return;
    setCustomTimes((prev) => {
      const copy = [...prev];
      copy[index] = newTime;
      return copy;
    });
  };

  const resetToDefaultTimes = () => {
    const defaults = DEFAULT_TIME_SLOTS[postsPerDay] || ["10:00"];
    setCustomTimes([...defaults]);
    toast.success("Reset to AI recommended peak times");
  };

  const activeFormattedTimes = useMemo(() => {
    return customTimes.slice(0, postsPerDay).map((t) => formatTimeDisplay(t));
  }, [customTimes, postsPerDay]);

  const timeSlotsPreview = activeFormattedTimes;

  // Save Brand Profile mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: BrandProfile) => {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {}
      }
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save brand profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Brand Profile saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["brand-profile", user.id] });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save. Please try again.");
    },
  });

  // Configure & Schedule AI Posts mutation
  const configureAndScheduleMutation = useMutation({
    mutationFn: async () => {
      // 1. Validation
      if (!form.business_name.trim()) {
        throw new Error("Please enter your Business Name first");
      }
      if (!form.niche.trim()) {
        throw new Error("Please enter your Niche / Industry first");
      }
      if (!form.target_audience.trim()) {
        throw new Error("Please specify your Target Audience");
      }

      setScheduleProgress("Analyzing Brand Profile & DNA...");
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(form));
        } catch {}
      }

      // Save brand profile first
      await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      setScheduleProgress(`Analyzing audience & generating ${totalPostsToSchedule} posts across ${days} days...`);

      // 2. Execute auto-pilot scheduling with filters
      const res = await fetch("/api/ai/auto-pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.business_name,
          niche: form.niche,
          targetAudience: form.target_audience,
          brandTone: form.brand_tone,
          mainOffer: form.main_offer,
          competitors: form.competitors,
          days,
          postsPerDay,
          customTimeSlots: activeFormattedTimes,
          selectedChannelIds: selectedChannelIds.length > 0 ? selectedChannelIds : undefined,
          generateImages,
          postStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to schedule posts with AI");
      }

      return res.json();
    },
    onSuccess: (resData) => {
      setScheduleResult(resData);
      setScheduleProgress("");
      toast.success(resData.message || `Successfully scheduled ${totalPostsToSchedule} posts!`);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
    },
    onError: (err: Error) => {
      setScheduleProgress("");
      toast.error(err.message || "Failed to schedule posts. Please try again.");
    },
  });

  const handleSaveOnly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name.trim()) {
      toast.error("Please enter your business name");
      return;
    }
    if (!form.niche.trim()) {
      toast.error("Please enter your niche or industry");
      return;
    }
    if (!form.target_audience.trim()) {
      toast.error("Please specify your target audience");
      return;
    }
    saveMutation.mutate(form);
  };

  const isConfiguring = configureAndScheduleMutation.isPending;
  const activeBusinessName = data?.profile?.business_name || form.business_name;
  const activeNiche = data?.profile?.niche || form.niche;
  const activeTone = data?.profile?.brand_tone || form.brand_tone || "Professional";
  const isSaved = Boolean(activeBusinessName && activeNiche);

  return (
    <div className="space-y-8">
      {/* Active Brand Status Banner */}
      {isSaved && (
        <div className="p-4 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold shadow-xs">
              <Briefcase className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">{activeBusinessName}</p>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/25 py-0 px-1.5">
                  Active Brand
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {activeNiche} • <span className="text-foreground font-medium">{activeTone} Tone</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Check className="size-3.5" /> Synced with AI Engine
          </span>
        </div>
      )}

      {/* SECTION 1: Brand Profile Identity Form */}
      <form onSubmit={handleSaveOnly} className="space-y-5">
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              1. Brand Identity & Persona
            </h2>
            <p className="text-xs text-muted-foreground">
              Define your core company credentials so generated posts faithfully reflect your tone and value.
            </p>
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={saveMutation.isPending || isProfileLoading || isConfiguring}
            className="gap-1.5 text-xs font-semibold h-8"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" /> Save Profile
              </>
            )}
          </Button>
        </div>

        {!isMounted || isProfileLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Business Name */}
            <FormField
              id="brand-business-name"
              label="Business Name"
              required
              description="Your company, practice, or brand name"
              icon={FIELD_ICONS.business_name}
            >
              <Input
                id="brand-business-name"
                placeholder="e.g. Apex Health Clinic, Urban Roast Cafe, Zenith Law"
                value={form.business_name}
                onChange={(e) => set("business_name", e.target.value)}
                required
              />
            </FormField>

            {/* Niche */}
            <FormField
              id="brand-niche"
              label="Niche / Industry & Product"
              required
              description="What products or services do you provide?"
              icon={FIELD_ICONS.niche}
            >
              <Input
                id="brand-niche"
                placeholder="e.g. Cosmetic Dentistry, Handcrafted Organic Bakery, Corporate Tax"
                value={form.niche}
                onChange={(e) => set("niche", e.target.value)}
                required
              />
            </FormField>

            {/* Target Audience */}
            <div className="sm:col-span-2">
              <FormField
                id="brand-target-audience"
                label="Target Audience & Demographics"
                required
                description="Who are your ideal customers and what problems do they have?"
                icon={FIELD_ICONS.target_audience}
              >
                <Textarea
                  id="brand-target-audience"
                  placeholder="e.g. Working professionals aged 25-45 in urban metro cities seeking convenient high-quality services"
                  value={form.target_audience}
                  onChange={(e) => set("target_audience", e.target.value)}
                  className="min-h-[68px] resize-none"
                  required
                />
              </FormField>
            </div>

            {/* Brand Tone */}
            <div className="sm:col-span-2">
              <FormField
                id="brand-tone"
                label="Brand Voice & Tone"
                description="How should the AI communicate in ad copy and posts?"
                icon={FIELD_ICONS.brand_tone}
              >
                <div className="grid grid-cols-5 gap-2">
                  {BRAND_TONES.map((tone) => (
                    <button
                      key={tone.value}
                      type="button"
                      id={`brand-tone-${tone.value.toLowerCase()}`}
                      onClick={() => set("brand_tone", tone.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition-all",
                        form.brand_tone === tone.value
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/40"
                      )}
                    >
                      <span>{tone.label}</span>
                    </button>
                  ))}
                </div>
              </FormField>
            </div>

            {/* Main Offer */}
            <FormField
              id="brand-main-offer"
              label="Primary Offer / Value Proposition (Optional)"
              description="Special package, discount, guarantee, or key USP"
              icon={FIELD_ICONS.main_offer}
            >
              <Input
                id="brand-main-offer"
                placeholder="e.g. Free Consultation + 20% Off First Visit, Free 7-Day Trial"
                value={form.main_offer}
                onChange={(e) => set("main_offer", e.target.value)}
              />
            </FormField>

            {/* Competitor Handles */}
            <FormField
              id="brand-competitors"
              label="Competitor Handles / Market References (Optional)"
              description="Handles or brands for market positioning (comma separated)"
              icon={FIELD_ICONS.competitors}
            >
              <Input
                id="brand-competitors"
                placeholder="e.g. @competitor1, @competitor2, IndustryLeader"
                value={form.competitors}
                onChange={(e) => set("competitors", e.target.value)}
              />
            </FormField>

            {/* Target Location / Geography */}
            <FormField
              id="brand-location"
              label="Location / Target Geography"
              description="City, state, or countries targeted (e.g. Indore, India, Worldwide)"
              icon={FIELD_ICONS.location}
            >
              <Input
                id="brand-location"
                placeholder="e.g. Indore & Central India, or United States & UK"
                value={form.location || ""}
                onChange={(e) => set("location", e.target.value)}
              />
            </FormField>

            {/* Calendar Booking Link */}
            <FormField
              id="brand-booking-url"
              label="Calendar Booking URL (Cal.com / Calendly)"
              description="Used by AI Chatbot & WhatsApp Bot to book appointments automatically"
              icon={FIELD_ICONS.booking_url}
            >
              <Input
                id="brand-booking-url"
                placeholder="e.g. https://cal.com/your-brand/consultation"
                value={form.booking_url || ""}
                onChange={(e) => set("booking_url", e.target.value)}
              />
            </FormField>

            {/* Products & Services Catalog */}
            <div className="sm:col-span-2">
              <FormField
                id="brand-products-services"
                label="Products & Services Catalog"
                description="List your flagship services, packages, or SKUs so the AI can explain them accurately"
                icon={FIELD_ICONS.products_services}
              >
                <Textarea
                  id="brand-products-services"
                  placeholder="e.g. 1. Complete Growth Funnel Setup (₹45,000)&#10;2. Performance Meta Ads Management (₹25,000/mo)&#10;3. AI Chatbot Integration (₹15,000 one-time)"
                  value={form.products_services || ""}
                  onChange={(e) => set("products_services", e.target.value)}
                  className="min-h-[70px] resize-none"
                />
              </FormField>
            </div>

            {/* Pricing & Guarantee Details */}
            <div className="sm:col-span-2">
              <FormField
                id="brand-pricing-details"
                label="Pricing Structure & Guarantee"
                description="Special pricing rules, refunds, or risk-reversal guarantees"
                icon={FIELD_ICONS.pricing_details}
              >
                <Input
                  id="brand-pricing-details"
                  placeholder="e.g. 100% money-back guarantee within 14 days; custom quotes for enterprise tiers"
                  value={form.pricing_details || ""}
                  onChange={(e) => set("pricing_details", e.target.value)}
                />
              </FormField>
            </div>

            {/* Brand Knowledge Base & Document Vault */}
            <div className="sm:col-span-2">
              <FormField
                id="brand-knowledge-docs"
                label="Brand Knowledge Base & Document Vault (RAG Grounding)"
                description="Paste company docs, product manuals, FAQs, or brochure text so the AI answers with zero hallucinations"
                icon={FIELD_ICONS.knowledge_docs}
              >
                <Textarea
                  id="brand-knowledge-docs"
                  placeholder="Paste company FAQs, customer onboarding guides, warranty policies, service agreements, or sales pitch decks here..."
                  value={form.knowledge_docs || ""}
                  onChange={(e) => set("knowledge_docs", e.target.value)}
                  className="min-h-[85px] resize-none text-xs leading-relaxed"
                />
              </FormField>
            </div>
          </div>
        )}
      </form>

      {/* SECTION 2: AI Brand Analysis & Scheduling Configuration */}
      <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary animate-pulse" />
              <h2 className="text-lg font-bold text-foreground">
                2. AI Brand Analysis & Autonomous Scheduling
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set your posting frequency and duration. Click <strong>Analyze Brand & Schedule</strong> to analyze your brand profile, generate content, and schedule all posts into your calendar.
            </p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-1 font-semibold">
            AI Brand Analysis
          </Badge>
        </div>

        {/* Filter 1: How Many Days? */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Calendar className="size-4 text-primary" />
              How Many Days to Schedule?
            </label>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              {days} {days === 1 ? "Day" : "Days"} ({dateRangePreview})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_DAYS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setDays(preset.value)}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border-2 text-xs transition-all",
                  days === preset.value
                    ? "border-primary bg-primary/15 text-primary font-bold shadow-sm ring-1 ring-primary/30"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <span className="text-sm font-bold">{preset.label}</span>
                <span className="text-[10px] opacity-80">{preset.sub}</span>
              </button>
            ))}
          </div>

          {/* Custom Days Range Slider */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[11px] text-muted-foreground shrink-0">Custom Days (1 – 30):</span>
            <input
              type="range"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-foreground w-7 text-right">{days}d</span>
          </div>
        </div>

        {/* Filter 2: How Much Post in a Day? */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-primary" />
              How Many Posts in a Day? (Daily Frequency)
            </label>
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              {postsPerDay} {postsPerDay === 1 ? "Post" : "Posts"} / Day
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESET_POSTS_PER_DAY.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setPostsPerDay(preset.value)}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border-2 text-xs transition-all",
                  postsPerDay === preset.value
                    ? "border-primary bg-primary/15 text-primary font-bold shadow-sm ring-1 ring-primary/30"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <span className="text-sm font-bold">{preset.label}</span>
                <span className="text-[10px] opacity-80">{preset.desc}</span>
              </button>
            ))}
          </div>

          {/* Customizable Posting Time Slots */}
          <div className="p-3.5 rounded-xl bg-card border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Clock className="size-3.5 text-primary" />
                <span>Customize Daily Posting Time for each Post:</span>
              </div>
              <button
                type="button"
                onClick={resetToDefaultTimes}
                className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                Reset to AI Peak Times
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Adjust each time slot below. AI will automatically schedule posts at these exact times every day.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {customTimes.slice(0, postsPerDay).map((timeVal, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-background hover:border-primary/50 transition-all shadow-2xs"
                >
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                      Post #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {formatTimeDisplay(timeVal)}
                    </span>
                  </div>
                  <input
                    type="time"
                    value={timeVal}
                    onChange={(e) => updateTimeSlot(idx, e.target.value)}
                    className="h-8 px-2 rounded-lg border bg-card text-foreground font-mono text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    title={`Change time for Post #${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filter 3: Target Channels Distribution */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="size-4 text-primary" />
              Target Channels for Distribution
            </label>
            <button
              type="button"
              onClick={selectAllChannels}
              className="text-[11px] text-primary hover:underline font-semibold"
            >
              {selectedChannelIds.length === channels.length && channels.length > 0
                ? "Deselect All"
                : "Select All Channels"}
            </button>
          </div>

          {channels.length === 0 ? (
            <div className="p-3 rounded-xl border border-dashed text-xs text-muted-foreground flex items-center justify-between">
              <span>All standard channels (Twitter/X, LinkedIn, Instagram) will be auto-configured.</span>
              <Badge variant="outline" className="text-[10px]">Auto-Provisioned</Badge>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {channels.map((ch) => {
                const isSelected =
                  selectedChannelIds.length === 0 || selectedChannelIds.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border-2 text-xs transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground font-semibold"
                        : "border-border bg-card/60 text-muted-foreground opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ch.color || "#1877F2" }}
                      />
                      <span className="truncate">{ch.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Posts will be evenly balanced across selected channels so your audience receives diverse, coordinated updates.
          </p>
        </div>

        {/* Options: Visual Generation & Post Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div className="space-y-0.5 pr-2">
              <label htmlFor="gen-images" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                <ImageIcon className="size-3.5 text-primary" />
                8K Photorealistic Visuals
              </label>
              <p className="text-[10px] text-muted-foreground">
                Generate authentic commercial photography for each post
              </p>
            </div>
            <Switch
              id="gen-images"
              checked={generateImages}
              onCheckedChange={setGenerateImages}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div className="space-y-0.5 pr-2">
              <label htmlFor="post-status" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                <Send className="size-3.5 text-primary" />
                Schedule for Auto-Publish
              </label>
              <p className="text-[10px] text-muted-foreground">
                {postStatus === "queue" ? "Scheduled & active in Queue" : "Placed in Calendar as Drafts"}
              </p>
            </div>
            <Switch
              id="post-status"
              checked={postStatus === "queue"}
              onCheckedChange={(checked) => setPostStatus(checked ? "queue" : "draft")}
            />
          </div>
        </div>

        {/* Live Calculation Summary Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border border-primary/25 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkle className="size-4 text-primary" />
              Scheduling Plan Summary
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                {days} Days × {postsPerDay} {postsPerDay === 1 ? "Post" : "Posts"}/Day =
              </span>
              <span className="text-xs font-extrabold text-primary bg-background/90 px-3 py-1 rounded-full border border-primary/30 shadow-2xs">
                {totalPostsToSchedule} Total Posts
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 text-muted-foreground">
            <div>
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">Duration</span>
              <strong className="text-foreground">{days} Days</strong>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">Frequency</span>
              <strong className="text-foreground">{postsPerDay} Post{postsPerDay > 1 ? "s" : ""}/day</strong>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">Daily Post Times</span>
              <strong className="text-foreground text-[11px] truncate block" title={activeFormattedTimes.join(", ")}>
                {activeFormattedTimes.join(", ")}
              </strong>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-muted-foreground">Calendar Span</span>
              <strong className="text-foreground">{dateRangePreview}</strong>
            </div>
          </div>
        </div>

        {/* Primary Analysis & Schedule Button */}
        <div className="space-y-3 pt-2">
          <Button
            type="button"
            id="configure-and-schedule-btn"
            disabled={isConfiguring || !form.business_name || !form.niche}
            onClick={() => configureAndScheduleMutation.mutate()}
            className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2 rounded-xl transition-all cursor-pointer"
          >
            {isConfiguring ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span>{scheduleProgress || `Analyzing Brand & Scheduling ${totalPostsToSchedule} Posts (${days}d × ${postsPerDay}/d)...`}</span>
              </>
            ) : (
              <>
                <Sparkles className="size-5" />
                <span>Analyze Brand & Auto-Schedule {totalPostsToSchedule} Posts ({days} Days × {postsPerDay}/Day)</span>
              </>
            )}
          </Button>

          {/* Privacy Note */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Strictly isolated to your account • Content saved directly to your calendar queue</span>
          </div>
        </div>

        {/* Schedule Result Panel */}
        {scheduleResult && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 animate-in fade-in-50 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    {scheduleResult.message}
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    Covering {scheduleResult.summary?.dateRangeLabel || dateRangePreview} • Fully populated in Calendar
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/schedule"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Calendar className="size-3.5" /> Open Calendar ➔
                </Link>
                <Link
                  href="/schedule?view=list"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border hover:bg-accent text-foreground text-xs font-semibold transition-colors"
                >
                  View Post List
                </Link>
              </div>
            </div>

            {/* Preview of Scheduled Posts */}
            {Array.isArray(scheduleResult.createdPosts) && scheduleResult.createdPosts.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-emerald-500/20">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                  Scheduled Posts Snapshot ({scheduleResult.createdPosts.length}):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {scheduleResult.createdPosts.slice(0, 6).map((post: any, idx: number) => {
                    const postDate = new Date(post.scheduled_at);
                    const formattedDate = postDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    const formattedTime = postDate.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-card/90 border text-xs space-y-1 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {formattedDate} at {formattedTime}
                          </span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1 bg-primary/5 text-primary border-primary/20">
                            {post.user_channels?.channel_types?.name || "Social Post"}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-[11px] text-foreground/90">
                          {post.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-Component: FormField ──────────────────────────────────────────────────
function FormField({
  id,
  label,
  required,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 text-muted-foreground" />}
          {label}
          {required && <span className="text-destructive font-bold">*</span>}
        </label>
      </div>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}

