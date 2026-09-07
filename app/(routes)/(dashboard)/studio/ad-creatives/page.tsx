"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Sparkles, Copy, Check, Calendar, ArrowRight } from "lucide-react";
import ScheduleFromResearchDialog from "@/components/competition/schedule-from-research-dialog";
import Link from "next/link";

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Learn More",
  SHOP_NOW: "Shop Now",
  SIGN_UP: "Sign Up",
  GET_QUOTE: "Get Quote",
  BOOK_NOW: "Book Now",
  CONTACT_US: "Contact Us",
};

export default function AdCreativesStudioPage() {
  const [form, setForm] = useState({
    objective: "LEAD_GENERATION",
    offer: "",
    targetAudience: "",
    platform: "Meta Ads",
    generateImage: false,
  });
  const [variations, setVariations] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedAdText, setSelectedAdText] = useState("");

  // Restore cached variations on page mount / tab switch
  useEffect(() => {
    try {
      const cached = localStorage.getItem("lemon_ad_creatives");
      if (cached) setVariations(JSON.parse(cached));
      const cachedForm = localStorage.getItem("lemon_ad_form");
      if (cachedForm) setForm(JSON.parse(cachedForm));
    } catch {}
  }, []);

  // Persist variations and form
  useEffect(() => {
    if (variations.length > 0) {
      try {
        localStorage.setItem("lemon_ad_creatives", JSON.stringify(variations));
      } catch {}
    }
  }, [variations]);

  useEffect(() => {
    if (form.offer) {
      try {
        localStorage.setItem("lemon_ad_form", JSON.stringify(form));
      } catch {}
    }
  }, [form]);

  const clearAds = () => {
    setVariations([]);
    try {
      localStorage.removeItem("lemon_ad_creatives");
    } catch {}
    toast.info("Ad creatives reset. Ready for a new offer.");
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/ai/studio-ad-creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setVariations(data.variations || []);
      toast.success("3 ad variations generated!");
    },
    onError: (err: any) => toast.error(err.message || "Generation failed"),
  });

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="size-6 text-primary" />
          Ad Creatives Studio
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate 3 high-converting ad copy variations with AI — ready for Meta Ads
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ad-objective">Campaign Objective</Label>
            <Select
              value={form.objective}
              onValueChange={(v) => setForm((f) => ({ ...f, objective: v }))}
            >
              <SelectTrigger id="ad-objective">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LEAD_GENERATION">🎯 Lead Generation</SelectItem>
                <SelectItem value="SALES">💰 Sales / Conversions</SelectItem>
                <SelectItem value="BRAND_AWARENESS">📢 Brand Awareness</SelectItem>
                <SelectItem value="TRAFFIC">🌐 Website Traffic</SelectItem>
                <SelectItem value="ENGAGEMENT">❤️ Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-platform">Ad Platform</Label>
            <Select
              value={form.platform}
              onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
            >
              <SelectTrigger id="ad-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Meta Ads">📘 Meta Ads (Facebook + Instagram)</SelectItem>
                <SelectItem value="Instagram Only">📸 Instagram Only</SelectItem>
                <SelectItem value="Facebook Only">📘 Facebook Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="ad-offer">
              Your Offer / Product <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ad-offer"
              placeholder="e.g. 30-day fitness transformation program at ₹4,999"
              value={form.offer}
              onChange={(e) => setForm((f) => ({ ...f, offer: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="ad-audience">Target Audience</Label>
            <Input
              id="ad-audience"
              placeholder="e.g. Men 25-40 in Mumbai who want to lose weight"
              value={form.targetAudience}
              onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              id="gen-image-switch"
              checked={form.generateImage}
              onCheckedChange={(v) => setForm((f) => ({ ...f, generateImage: v }))}
            />
            <Label htmlFor="gen-image-switch" className="cursor-pointer">
              Generate AI image for first variation{" "}
              <span className="text-muted-foreground text-xs">(adds ~30 seconds)</span>
            </Label>
          </div>
          <div className="md:col-span-2">
            <Button
              id="generate-ad-btn"
              onClick={() => mutate(form)}
              disabled={isPending || !form.offer.trim()}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <>
                  <Sparkles className="size-4 mr-2 animate-spin" />
                  Generating 3 Variations…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Generate 3 Ad Variations
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {variations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
            <div>
              <p className="font-semibold text-sm">3 Ad Creatives Ready!</p>
              <p className="text-xs text-muted-foreground">
                Pain-point, benefit, and urgency angles optimized for conversion.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAds}
              className="h-8 text-xs"
            >
              New Ads / Reset
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {variations.map((v: any, i: number) => (
            <Card key={i} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{v.variationName}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {CTA_LABELS[v.callToAction] || v.callToAction}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-1 flex flex-col">
                {v.imageUrl && (
                  <img
                    src={v.imageUrl}
                    alt={`Ad creative variation ${i + 1}`}
                    className="w-full rounded-lg object-cover aspect-square"
                  />
                )}

                {/* Headline */}
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">HEADLINE</p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold">{v.headline}</p>
                    <button
                      onClick={() => copyText(v.headline, `h-${i}`)}
                      className="shrink-0"
                    >
                      {copied === `h-${i}` ? (
                        <Check className="size-3.5 text-green-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Text */}
                <div className="space-y-0.5 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground">PRIMARY TEXT</p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-relaxed">{v.primaryText}</p>
                    <button
                      onClick={() => copyText(v.primaryText, `p-${i}`)}
                      className="shrink-0 mt-0.5"
                    >
                      {copied === `p-${i}` ? (
                        <Check className="size-3.5 text-green-500" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {v.description && (
                  <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2">
                    {v.description}
                  </p>
                )}

                {v.whyItWorks && (
                  <p className="text-xs bg-primary/5 border border-primary/20 rounded-lg p-2">
                    💡 {v.whyItWorks}
                  </p>
                )}

                <div className="pt-2 border-t mt-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => {
                      setSelectedAdText(`${v.headline}\n\n${v.primaryText}\n\n${v.callToAction}`);
                      setIsScheduleOpen(true);
                    }}
                  >
                    <Calendar className="size-3 mr-1" /> Schedule Ad
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="h-7 text-xs px-2"
                  >
                    <Link href="/meta-ads">
                      Meta Ads <ArrowRight className="size-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      )}

      <ScheduleFromResearchDialog
        open={isScheduleOpen}
        onOpenChange={setIsScheduleOpen}
        mode="single"
        initialTopic={selectedAdText || form.offer}
        suggestedFormat="META_AD"
        researchContext={{
          niche: form.offer,
          targetAudience: form.targetAudience,
        }}
      />
    </div>
  );
}
