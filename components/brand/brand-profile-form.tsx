"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  Briefcase,
  Clock,
  BookOpen,
  RotateCcw,
  Sparkle,
} from "lucide-react";
import AutonomousCampaignDialog from "@/components/campaign/autonomous-campaign-dialog";

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

const BRAND_TONES = [
  { value: "Professional", label: "Professional" },
  { value: "Friendly", label: "Friendly" },
  { value: "Bold", label: "Bold" },
  { value: "Luxury", label: "Luxury" },
  { value: "Energetic", label: "Energetic" },
];

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
  const [isMounted, setIsMounted] = useState(false);
  const [isAutonomousDialogOpen, setIsAutonomousDialogOpen] = useState<boolean>(false);

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
        products_services: data.profile.products_services ?? "",
        pricing_details: data.profile.pricing_details ?? "",
        knowledge_docs: data.profile.knowledge_docs ?? "",
        location: data.profile.location ?? "India & Global",
        booking_url: data.profile.booking_url ?? "",
      };
      setForm(loadedProfile);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(loadedProfile));
        } catch {}
      }
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

  const handleSaveOnly = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const handleResetForm = () => {
    if (data?.profile) {
      setForm({
        business_name: data.profile.business_name ?? "",
        niche: data.profile.niche ?? "",
        target_audience: data.profile.target_audience ?? "",
        brand_tone: data.profile.brand_tone ?? "Professional",
        main_offer: data.profile.main_offer ?? "",
        competitors: data.profile.competitors ?? "",
        products_services: data.profile.products_services ?? "",
        pricing_details: data.profile.pricing_details ?? "",
        knowledge_docs: data.profile.knowledge_docs ?? "",
        location: data.profile.location ?? "India & Global",
        booking_url: data.profile.booking_url ?? "",
      });
      toast.success("Reset form to saved profile");
    } else {
      setForm(EMPTY_PROFILE);
    }
  };

  const activeBusinessName = data?.profile?.business_name || form.business_name;
  const activeNiche = data?.profile?.niche || form.niche;
  const activeTone = data?.profile?.brand_tone || form.brand_tone || "Professional";
  const isSaved = Boolean(activeBusinessName && activeNiche);

  return (
    <div className="space-y-6">
      {/* Active Brand Status Banner */}
      {isSaved && (
        <div className="p-4 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold shadow-2xs">
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsAutonomousDialogOpen(true)}
              className="gap-1.5 text-xs font-semibold h-8 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Sparkles className="size-3.5" /> Launch Auto-Pilot Campaign
            </Button>
            <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Check className="size-3.5" /> Synced with AI
            </span>
          </div>
        </div>
      )}

      {/* Brand Profile Identity Form */}
      <form onSubmit={handleSaveOnly} className="space-y-6 rounded-2xl border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Brand Identity & Knowledge Vault
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define your core company credentials so all AI campaigns and post generators faithfully reflect your tone and value.
            </p>
          </div>
          <Button
            type="submit"
            size="sm"
            variant="default"
            disabled={saveMutation.isPending || isProfileLoading}
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
                        "flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition-all cursor-pointer",
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

        {/* Bottom Form Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetForm}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="size-3.5" /> Reset to Saved
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="default"
              disabled={saveMutation.isPending || isProfileLoading}
              className="gap-1.5 text-xs font-bold px-5"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save className="size-4" /> Save Brand Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Auto-Pilot Campaign Navigation Card */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-card p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkle className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Launch Auto-Pilot Campaign</h3>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Automate multi-format Reels, Carousels, Social Posts, and Meta Ads based on this saved brand profile. Open Auto-Pilot anytime from the navigation panel.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setIsAutonomousDialogOpen(true)}
          className="gap-2 text-xs font-bold shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
        >
          <Sparkles className="size-4" /> Open Auto-Pilot
        </Button>
      </div>

      <AutonomousCampaignDialog
        open={isAutonomousDialogOpen}
        onOpenChange={setIsAutonomousDialogOpen}
        initialBusinessName={form.business_name}
        initialNiche={form.niche}
        initialAudience={form.target_audience}
      />
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
