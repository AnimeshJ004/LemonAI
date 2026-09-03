"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  ChevronRight,
  Briefcase,
  Target,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BrandProfile {
  id?: string;
  business_name: string;
  niche: string;
  target_audience: string;
  brand_tone: string;
  main_offer: string;
  competitors: string;
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
};

// ─── Field Config ─────────────────────────────────────────────────────────────
const FIELD_ICONS: Record<keyof BrandProfile, React.ElementType> = {
  id: Building2,
  business_name: Building2,
  niche: Sparkles,
  target_audience: Users,
  brand_tone: Megaphone,
  main_offer: Gift,
  competitors: Link2,
};

// ─── Component ────────────────────────────────────────────────────────────────
export function BrandProfileForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BrandProfile>(EMPTY_PROFILE);
  const [isInit, setIsInit] = useState(false);

  // Fetch existing profile
  const { isLoading, data } = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const res = await fetch("/api/brand");
      if (!res.ok) throw new Error("Failed to fetch brand profile");
      return res.json() as Promise<{ profile: BrandProfile | null; tableExists: boolean }>;
    },
  });

  // Initialize form from fetched data
  useEffect(() => {
    if (data?.profile && !isInit) {
      setForm({
        business_name: data.profile.business_name ?? "",
        niche: data.profile.niche ?? "",
        target_audience: data.profile.target_audience ?? "",
        brand_tone: data.profile.brand_tone ?? "Professional",
        main_offer: data.profile.main_offer ?? "",
        competitors: data.profile.competitors ?? "",
      });
      setIsInit(true);
    }
  }, [data, isInit]);

  const set = useCallback(<K extends keyof BrandProfile>(key: K, val: BrandProfile[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: BrandProfile) => {
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
      toast.success("Brand profile saved successfully! AI will now use your business context.");
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
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

  const isSaved = Boolean(data?.profile?.business_name);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Active Brand Status Banner */}
      {isSaved && data?.profile && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Briefcase className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Active Client Brand: <span className="text-primary font-bold">{data.profile.business_name}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {data.profile.niche} • {data.profile.brand_tone} Tone
              </p>
            </div>
          </div>
          <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="size-3" /> Synced with AI
          </span>
        </div>
      )}

      {/* Form Fields */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
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
              placeholder="e.g. Cosmetic Dentistry, Handcrafted Organic Bakery, Corporate Tax Consulting"
              value={form.niche}
              onChange={(e) => set("niche", e.target.value)}
              required
            />
          </FormField>

          {/* Target Audience */}
          <FormField
            id="brand-target-audience"
            label="Target Audience & Demographics"
            required
            description="Who are your ideal customers and where are they located?"
            icon={FIELD_ICONS.target_audience}
          >
            <Textarea
              id="brand-target-audience"
              placeholder="e.g. Working professionals aged 25-45 in urban metro cities seeking convenient dental care"
              value={form.target_audience}
              onChange={(e) => set("target_audience", e.target.value)}
              className="min-h-[70px] resize-none"
              required
            />
          </FormField>

          {/* Brand Tone */}
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
                    "flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-[10px] font-medium transition-all",
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

          {/* Main Offer */}
          <FormField
            id="brand-main-offer"
            label="Primary Offer / Value Proposition (Optional)"
            description="What unique discount, package, or hook should the AI emphasize?"
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
            label="Competitor Social Handles / Market References (Optional)"
            description="Handles or brands in your space for AI competitive intelligence (comma separated)"
            icon={FIELD_ICONS.competitors}
          >
            <Input
              id="brand-competitors"
              placeholder="e.g. @competitor1, @competitor2, BrandName"
              value={form.competitors}
              onChange={(e) => set("competitors", e.target.value)}
            />
          </FormField>
        </div>
      )}

      {/* Save Button */}
      <div className="pt-2">
        <Button
          type="submit"
          id="save-brand-profile-btn"
          disabled={saveMutation.isPending || isLoading}
          className="w-full gap-2 h-11 text-sm font-semibold"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving Business Profile...
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save Brand Profile & Configure AI
            </>
          )}
        </Button>
      </div>
    </form>
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
