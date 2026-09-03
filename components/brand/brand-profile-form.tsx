"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dumbbell,
  ShoppingBag,
  Sparkles,
  ChevronRight,
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
  { value: "Professional", label: "🤝 Professional" },
  { value: "Friendly", label: "😊 Friendly" },
  { value: "Bold", label: "⚡ Bold" },
  { value: "Luxury", label: "💎 Luxury" },
  { value: "Energetic", label: "🔥 Energetic" },
];

const EMPTY_PROFILE: BrandProfile = {
  business_name: "",
  niche: "",
  target_audience: "",
  brand_tone: "Professional",
  main_offer: "",
  competitors: "",
};

// ─── Demo Presets ─────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: "dental",
    icon: Building2,
    label: "Dental Clinic",
    color: "from-blue-500 to-cyan-500",
    data: {
      business_name: "Apex Dental Studio",
      niche: "Cosmetic Dentistry & Clear Aligners",
      target_audience: "Adults 24-45 looking for smile makeover in Mumbai",
      brand_tone: "Professional",
      main_offer: "Free 3D Smile Scan + 20% Off Aligners",
      competitors: "@clovedental, @toothsi",
    },
  },
  {
    id: "gym",
    icon: Dumbbell,
    label: "Gym / Fitness",
    color: "from-orange-500 to-red-500",
    data: {
      business_name: "IronForge Athletic Club",
      niche: "High-Performance CrossFit & Body Transformation",
      target_audience: "Fitness enthusiasts aged 20-40 seeking 30-day transformation",
      brand_tone: "Energetic",
      main_offer: "First Week FREE + Free Personal Training Session",
      competitors: "@cult.fit, @fitnesspark",
    },
  },
  {
    id: "ecommerce",
    icon: ShoppingBag,
    label: "E-Commerce",
    color: "from-emerald-500 to-teal-500",
    data: {
      business_name: "Aura Glow Skincare",
      niche: "Organic Vegan Botanical Skincare",
      target_audience: "Women 22-40 interested in clean beauty & natural skincare",
      brand_tone: "Luxury",
      main_offer: "30% Off First Order + Free Shipping Over ₹999",
      competitors: "@mamaearth, @pilgrimbeauty",
    },
  },
];

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
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
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

  const mutation = useMutation({
    mutationFn: async (payload: BrandProfile) => {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      return json;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
      if (result.sqlFile) {
        toast.warning("Table not created yet!", {
          description: `Run the SQL in ${result.sqlFile} in your InsForge dashboard first.`,
          duration: 10000,
        });
      } else {
        toast.success("Brand profile saved! 🎉", {
          description: "Your AI will now use this to create high-converting ads.",
        });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const set = useCallback(<K extends keyof BrandProfile>(key: K, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPreset(presetId);
    setForm(preset.data);
    toast.info(`Preset applied: ${preset.data.business_name}`, { duration: 2000 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const isSaving = mutation.isPending;
  const isSuccess = mutation.isSuccess && !mutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Presets */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Quick Start with a Demo Preset
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                id={`brand-preset-${preset.id}`}
                onClick={() => applyPreset(preset.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                  selectedPreset === preset.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                <div
                  className={cn(
                    "size-9 rounded-full flex items-center justify-center bg-gradient-to-br text-white shrink-0",
                    preset.color
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <span className="text-[11px] font-medium text-center leading-tight text-foreground">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-dashed border-border" />

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
            description="Your brand or company name"
            icon={FIELD_ICONS.business_name}
          >
            <Input
              id="brand-business-name"
              placeholder="e.g. Apex Dental Studio"
              value={form.business_name}
              onChange={(e) => set("business_name", e.target.value)}
              required
            />
          </FormField>

          {/* Niche */}
          <FormField
            id="brand-niche"
            label="Niche / Industry"
            required
            description="What do you specialize in?"
            icon={FIELD_ICONS.niche}
          >
            <Input
              id="brand-niche"
              placeholder="e.g. Cosmetic Dentistry & Clear Aligners"
              value={form.niche}
              onChange={(e) => set("niche", e.target.value)}
              required
            />
          </FormField>

          {/* Target Audience */}
          <FormField
            id="brand-target-audience"
            label="Target Audience"
            required
            description="Who are you trying to reach?"
            icon={FIELD_ICONS.target_audience}
          >
            <Textarea
              id="brand-target-audience"
              placeholder="e.g. Adults 24-45 looking for smile makeover in Mumbai"
              value={form.target_audience}
              onChange={(e) => set("target_audience", e.target.value)}
              className="min-h-[70px] resize-none"
              required
            />
          </FormField>

          {/* Brand Tone */}
          <FormField
            id="brand-tone"
            label="Brand Tone"
            description="How should your brand communicate?"
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
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <span className="text-base">{tone.label.split(" ")[0]}</span>
                  <span className="leading-tight text-center">{tone.label.split(" ")[1]}</span>
                </button>
              ))}
            </div>
          </FormField>

          {/* Main Offer */}
          <FormField
            id="brand-main-offer"
            label="Main Offer / Hook"
            required
            description="Your standout offer or lead magnet"
            icon={FIELD_ICONS.main_offer}
          >
            <Input
              id="brand-main-offer"
              placeholder="e.g. Free 3D Smile Scan + 20% Off Aligners"
              value={form.main_offer}
              onChange={(e) => set("main_offer", e.target.value)}
              required
            />
          </FormField>

          {/* Competitors */}
          <FormField
            id="brand-competitors"
            label="Competitor Handles / URLs"
            description="Know your competition (optional)"
            icon={FIELD_ICONS.competitors}
          >
            <Input
              id="brand-competitors"
              placeholder="e.g. @clovedental, @toothsi, competitor.com"
              value={form.competitors}
              onChange={(e) => set("competitors", e.target.value)}
            />
          </FormField>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          id="brand-save-btn"
          type="submit"
          disabled={isSaving || isLoading}
          className={cn(
            "flex-1 gap-2 transition-all",
            isSuccess && "bg-emerald-600 hover:bg-emerald-700"
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : isSuccess ? (
            <>
              <Check className="size-4" /> Saved!
            </>
          ) : (
            <>
              <Save className="size-4" /> Save Brand Profile
            </>
          )}
        </Button>

        {data?.profile && (
          <Button
            id="brand-go-to-ads"
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => (window.location.href = "/meta-ads")}
          >
            Create Ads <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      {/* Table warning */}
      {!isLoading && data && !data.tableExists && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
            ⚠️ Database Table Not Created Yet
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Run{" "}
            <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">
              lib/db/create-brand-profiles-and-meta-ads-tables.sql
            </code>{" "}
            in your InsForge dashboard SQL editor to create the required tables.
          </p>
        </div>
      )}
    </form>
  );
}

// ─── FormField helper ─────────────────────────────────────────────────────────
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
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-2">
        <Icon className="size-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
        {description && (
          <span className="text-[10px] text-muted-foreground ml-1">— {description}</span>
        )}
      </label>
      {children}
    </div>
  );
}
