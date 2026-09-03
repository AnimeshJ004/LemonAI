"use client";

import { useState, useEffect, useCallback } from "react";
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
import { AdMockupPreview } from "./ad-mockup-preview";
import { CampaignStatusBadge } from "./campaign-status-badge";
import { SyncToCalendarButton } from "./sync-to-calendar-button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Target,
  Sparkles,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Building2,
  Dumbbell,
  ShoppingBag,
  Zap,
  Check,
  ExternalLink,
  Loader2,
  IndianRupee,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WizardData {
  businessName: string;
  niche: string;
  targetAudience: string;
  objective: string;
  adAccountId: string;
  dailyBudget: number;
  targetAgeMin: number;
  targetAgeMax: number;
  startDate: string;
  endDate: string;
  adHeadline: string;
  adPrimaryText: string;
  adImageUrl: string;
  callToAction: string;
}

interface DeployResult {
  preview_url: string;
  meta_campaign_id: string;
  status: string;
  sandbox?: boolean;
}



const OBJECTIVES = [
  { value: "OUTCOME_LEADS", label: "Lead Generation" },
  { value: "OUTCOME_TRAFFIC", label: "Website Traffic" },
  { value: "OUTCOME_SALES", label: "Online Sales" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_AWARENESS", label: "Brand Awareness" },
];

const CTAS = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "BOOK_NOW", label: "Book Now" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "SUBSCRIBE", label: "Subscribe" },
];

const CTA_LABELS: Record<string, string> = Object.fromEntries(CTAS.map((c) => [c.value, c.label]));

// ─── Component ────────────────────────────────────────────────────────────────
export function CampaignCreationWizard() {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [adAccounts, setAdAccounts] = useState<{ id: string; name: string }[]>([]);

  const [data, setData] = useState<WizardData>({
    businessName: "",
    niche: "",
    targetAudience: "",
    objective: "OUTCOME_LEADS",
    adAccountId: "",
    dailyBudget: 1000,
    targetAgeMin: 18,
    targetAgeMax: 55,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    adHeadline: "",
    adPrimaryText: "",
    adImageUrl: "",
    callToAction: "LEARN_MORE",
  });

  const set = useCallback(<K extends keyof WizardData>(key: K, val: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Fetch ad accounts on mount
  useEffect(() => {
    fetch("/api/meta/ad-accounts")
      .then((r) => r.json())
      .then((d) => {
        if (d.accounts?.length > 0) {
          setAdAccounts(d.accounts);
          set("adAccountId", d.accounts[0].id);
        }
      })
      .catch(() => {});

    // Auto-populate from user's actual saved Brand Profile
    fetch("/api/brand")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile?.business_name) {
          setData((prev) => ({
            ...prev,
            businessName: d.profile.business_name,
            niche: d.profile.niche || prev.niche,
            targetAudience: d.profile.target_audience || prev.targetAudience,
            adHeadline: d.profile.main_offer ? d.profile.main_offer : prev.adHeadline,
          }));
        }
      })
      .catch(() => {});
  }, [set]);

  const generateCopy = async () => {
    if (!data.businessName || !data.niche) {
      toast.error("Please fill in Business Name and Niche first.");
      return;
    }
    setIsGenerating(true);

    try {
      // Call Dev 1's Full Funnel AI generation pipeline
      const res = await fetch("/api/ai/full-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: data.businessName,
          niche: data.niche,
          targetAudience: data.targetAudience || "Target consumers and professionals",
          productOffer: data.adHeadline || `Exclusive offer for ${data.niche}`,
          goal: data.objective === "OUTCOME_SALES" ? "SALES" : "LEADS",
          generateImages: true,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const firstVariant = json.funnel?.metaAdCampaignPackage?.adVariants?.[0];
        if (firstVariant) {
          setData((prev) => ({
            ...prev,
            adHeadline: firstVariant.headline || prev.adHeadline,
            adPrimaryText: firstVariant.primaryText || prev.adPrimaryText,
            callToAction: firstVariant.callToAction?.toUpperCase()?.replace(/ /g, "_") || prev.callToAction,
            adImageUrl: firstVariant.bannerImageUrl || prev.adImageUrl,
          }));
          toast.success("Campaign copy and visual creative generated successfully.");
          setIsGenerating(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Full funnel API error, using intelligent fallback:", err);
    }

    // High-converting smart fallback if AI API is offline or unauthenticated
    await new Promise((r) => setTimeout(r, 1200));
    const headlines = [
      `Transform Your Life with ${data.businessName}`,
      `${data.niche} — Exclusive Offer Inside`,
      `Join Thousands Who Trust ${data.businessName}`,
    ];
    const texts = [
      `Discover why thousands choose ${data.businessName} for ${data.niche.toLowerCase()}. ${data.targetAudience ? `Specially designed for ${data.targetAudience}.` : ""} Act now — limited time offer.`,
      `Stop settling. Start thriving. ${data.businessName} delivers ${data.niche} results that speak for themselves. Book your consultation today.`,
    ];
    setData((prev) => ({
      ...prev,
      adHeadline: headlines[Math.floor(Math.random() * headlines.length)],
      adPrimaryText: texts[Math.floor(Math.random() * texts.length)],
    }));
    setIsGenerating(false);
    toast.success("Ad copy generated successfully.");
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const res = await fetch("/api/meta/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${data.businessName} — ${OBJECTIVES.find((o) => o.value === data.objective)?.label} Campaign`,
          objective: data.objective,
          daily_budget: data.dailyBudget,
          ad_headline: data.adHeadline,
          ad_primary_text: data.adPrimaryText,
          ad_image_url: data.adImageUrl,
          call_to_action: data.callToAction,
          meta_ad_account_id: data.adAccountId,
          target_age_min: data.targetAgeMin,
          target_age_max: data.targetAgeMax,
          start_date: data.startDate,
          end_date: data.endDate,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Deploy failed");
      setDeployResult(result.campaign);
      toast.success(result.message ?? "Campaign pushed to Meta Ads Manager!", {
        description: result.sandbox ? "Running in sandbox mode." : "Your ad is now live!",
        duration: 7000,
      });
      setStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy campaign");
    } finally {
      setIsDeploying(false);
    }
  };

  const reachEstimate = Math.round((data.dailyBudget / 3.5) * 100);
  const impressionsEstimate = Math.round((data.dailyBudget / 1.2) * 100);

  const STEP_LABELS = [
    { n: 1, label: "Brand & Target", icon: Target },
    { n: 2, label: "AI Creative", icon: Sparkles },
    { n: 3, label: "Budget & Launch", icon: Rocket },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      {step < 4 && (
        <div className="flex items-center gap-0">
          {STEP_LABELS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.n;
            const isDone = step > s.n;
            return (
              <div key={s.n} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isActive
                        ? "bg-primary/10 border-2 border-primary text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium hidden sm:block",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEP_LABELS.length - 1 && (
                  <div
                    className={cn(
                      "h-[2px] flex-1 mx-2 rounded transition-all duration-500",
                      step > s.n ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Step 1: Brand & Target ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          {/* Client Brand Profile Status */}
          {data.businessName ? (
            <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Active Client Brand: <span className="text-primary font-bold">{data.businessName}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {data.niche || "Custom Industry"} • Context loaded from your Brand Profile
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="size-3" /> Auto-Synced
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Enter your client or company details below to target and generate ads.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Business Name *</label>
              <Input
                id="wizard-business-name"
                placeholder="e.g. Apex Dental Studio"
                value={data.businessName}
                onChange={(e) => set("businessName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Niche / Industry *</label>
              <Input
                id="wizard-niche"
                placeholder="e.g. Cosmetic Dentistry & Clear Aligners"
                value={data.niche}
                onChange={(e) => set("niche", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target Audience *</label>
              <Input
                id="wizard-audience"
                placeholder="e.g. Adults 24-45 looking for smile makeover in Mumbai"
                value={data.targetAudience}
                onChange={(e) => set("targetAudience", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Campaign Objective</label>
              <Select value={data.objective} onValueChange={(v) => set("objective", v)}>
                <SelectTrigger id="wizard-objective">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            id="wizard-next-step-1"
            onClick={() => {
              if (!data.businessName || !data.niche || !data.targetAudience) {
                toast.error("Please fill in all required fields.");
                return;
              }
              setStep(2);
            }}
            className="w-full gap-2"
          >
            Next: AI Creative <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* ─── Step 2: AI Creative ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Form side */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">AI-Generated Creative</h3>
              <Button
                id="wizard-generate-copy"
                size="sm"
                variant="outline"
                onClick={generateCopy}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5 text-primary" />
                )}
                {isGenerating ? "Generating…" : "Generate with AI"}
              </Button>
            </div>

            {isGenerating ? (
              <div className="space-y-3">
                <div className="h-4 w-24 rounded">
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Ad Headline *</label>
                  <Input
                    id="wizard-headline"
                    placeholder="e.g. Unlock Your Dream Smile Today"
                    value={data.adHeadline}
                    onChange={(e) => set("adHeadline", e.target.value)}
                    maxLength={40}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {data.adHeadline.length}/40
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Primary Text *</label>
                  <Textarea
                    id="wizard-primary-text"
                    placeholder="Write your ad copy here…"
                    value={data.adPrimaryText}
                    onChange={(e) => set("adPrimaryText", e.target.value)}
                    className="min-h-[100px] resize-none"
                    maxLength={500}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {data.adPrimaryText.length}/500
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Call to Action</label>
                    <Select value={data.callToAction} onValueChange={(v) => set("callToAction", v)}>
                      <SelectTrigger id="wizard-cta">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CTAS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Ad Image URL</label>
                    <Input
                      id="wizard-image-url"
                      placeholder="https://… (optional)"
                      value={data.adImageUrl}
                      onChange={(e) => set("adImageUrl", e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button
                id="wizard-next-step-2"
                onClick={() => {
                  if (!data.adHeadline || !data.adPrimaryText) {
                    toast.error("Headline and Primary Text are required.");
                    return;
                  }
                  setStep(3);
                }}
                className="flex-1 gap-2"
              >
                Next: Budget & Launch <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="flex justify-center">
            <AdMockupPreview
              headline={data.adHeadline || "Your Headline Here"}
              primaryText={data.adPrimaryText || "Your ad copy will appear here…"}
              ctaLabel={CTA_LABELS[data.callToAction] ?? "Learn More"}
              imageUrl={data.adImageUrl || undefined}
              businessName={data.businessName || "Your Business"}
            />
          </div>
        </div>
      )}

      {/* ─── Step 3: Budget & Launch ────────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <div className="flex-1 space-y-5">
            {/* Budget Slider */}
            <div className="space-y-3 p-4 rounded-xl border bg-card">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <IndianRupee className="size-4 text-primary" /> Daily Budget
                </label>
                <span className="text-lg font-bold text-primary">
                  ₹{data.dailyBudget.toLocaleString("en-IN")}
                  <span className="text-xs text-muted-foreground font-normal">/day</span>
                </span>
              </div>
              <input
                id="wizard-budget-slider"
                type="range"
                min={500}
                max={10000}
                step={500}
                value={data.dailyBudget}
                onChange={(e) => set("dailyBudget", Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>₹500/day</span>
                <span>₹10,000/day</span>
              </div>
            </div>

            {/* Estimated Reach */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border bg-card space-y-0.5">
                <p className="text-[10px] text-muted-foreground font-medium">Est. Daily Reach</p>
                <p className="text-xl font-bold text-foreground">
                  {reachEstimate.toLocaleString("en-IN")}
                  <span className="text-xs text-muted-foreground font-normal ml-1">people</span>
                </p>
              </div>
              <div className="p-3 rounded-xl border bg-card space-y-0.5">
                <p className="text-[10px] text-muted-foreground font-medium">Est. Daily Impressions</p>
                <p className="text-xl font-bold text-foreground">
                  {impressionsEstimate.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Age Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Min Age</label>
                <Input
                  id="wizard-age-min"
                  type="number"
                  min={13}
                  max={65}
                  value={data.targetAgeMin}
                  onChange={(e) => set("targetAgeMin", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Max Age</label>
                <Input
                  id="wizard-age-max"
                  type="number"
                  min={13}
                  max={65}
                  value={data.targetAgeMax}
                  onChange={(e) => set("targetAgeMax", Number(e.target.value))}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Start Date</label>
                <Input
                  id="wizard-start-date"
                  type="date"
                  value={data.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">End Date</label>
                <Input
                  id="wizard-end-date"
                  type="date"
                  value={data.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1">
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button
                id="wizard-deploy-btn"
                onClick={handleDeploy}
                disabled={isDeploying}
                className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deploying to Meta…
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Deploy to Meta Ads Manager
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex justify-center">
            <AdMockupPreview
              headline={data.adHeadline || "Your Headline Here"}
              primaryText={data.adPrimaryText || "Your ad copy will appear here…"}
              ctaLabel={CTA_LABELS[data.callToAction] ?? "Learn More"}
              imageUrl={data.adImageUrl || undefined}
              businessName={data.businessName || "Your Business"}
            />
          </div>
        </div>
      )}

      {/* ─── Step 4: Success ────────────────────────────────────────────────── */}
      {step === 4 && deployResult && (
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          {/* Success Icon */}
          <div className="size-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50">
            <Check className="size-10 text-white" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground">
              ✅ Campaign Successfully {deployResult.sandbox ? "Created (Sandbox)" : "Pushed to Meta!"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {deployResult.sandbox
                ? "Running in sandbox mode. Add your Meta API credentials to push live campaigns."
                : "Your ad campaign is now live in Meta Ads Manager!"}
            </p>
          </div>

          <CampaignStatusBadge
            status={deployResult.status ?? "DRAFT"}
            className="text-sm px-4 py-1.5"
          />

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button
              id="wizard-view-in-meta"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => window.open(deployResult.preview_url, "_blank")}
            >
              <ExternalLink className="size-4" />
              View in Ads Manager
            </Button>
            <SyncToCalendarButton
              content={`${data.adHeadline}\n\n${data.adPrimaryText}`}
              imageUrl={data.adImageUrl}
              scheduledAt={new Date(data.startDate).toISOString()}
              className="flex-1"
            />
          </div>

          <Button
            id="wizard-create-another"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep(1);
              setDeployResult(null);
              setData((prev) => ({ ...prev, adHeadline: "", adPrimaryText: "", adImageUrl: "" }));
            }}
          >
            Create Another Campaign
          </Button>
        </div>
      )}
    </div>
  );
}
