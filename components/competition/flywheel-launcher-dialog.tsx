"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Megaphone,
  Loader2,
  TrendingUp,
  FileText,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface FlywheelLauncherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultNiche?: string;
  defaultAudience?: string;
  defaultBusinessName?: string;
}

const FLYWHEEL_STEPS = [
  { id: 1, title: "Research Agent", desc: "Scrapes competitor angles & viral hooks" },
  { id: 2, title: "Content Studio", desc: "Generates Feed Post, Reel Script & Carousel" },
  { id: 3, title: "Distribution Agent", desc: "Auto-queues posts directly to Calendar" },
  { id: 4, title: "Ads Intelligence", desc: "Drafts high-ROAS Meta Ad Campaign" },
];

export default function FlywheelLauncherDialog({
  open,
  onOpenChange,
  defaultNiche = "",
  defaultAudience = "",
  defaultBusinessName = "",
}: FlywheelLauncherDialogProps) {
  const queryClient = useQueryClient();
  const [niche, setNiche] = useState(defaultNiche || "High-Ticket Coaching");
  const [audience, setAudience] = useState(defaultAudience || "Working Professionals");
  const [businessName, setBusinessName] = useState(defaultBusinessName || "My Business");
  const [days, setDays] = useState(7);
  const [draftAd, setDraftAd] = useState(true);
  const [result, setResult] = useState<any | null>(null);

  const { mutate: launchFlywheel, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/flywheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          targetAudience: audience,
          businessName,
          daysToSchedule: days,
          autoDraftMetaAd: draftAd,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Flywheel execution failed");
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Autonomous Flywheel completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["scheduled-posts"] });
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Flywheel execution encountered an error");
    },
  });

  const handleReset = () => {
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Zap className="size-5 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">LEMON AI ENGINE</span>
          </div>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Autonomous Multi-Agent Marketing Flywheel
          </DialogTitle>
          <DialogDescription className="text-xs">
            Triggers the complete continuous growth cycle: Research → Strategy → Content Studio → Scheduling → Meta Ads Draft in 1 click.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-5 py-2">
            {/* Visual Process Flow */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FLYWHEEL_STEPS.map((step) => (
                <div key={step.id} className="p-2.5 rounded-lg border bg-muted/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span className="size-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px]">
                      {step.id}
                    </span>
                    <span>{step.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Config Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Business Name</Label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Health Clinic"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Niche / Industry</Label>
                <Input
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. Cosmetic Dentistry, B2B SaaS"
                  className="text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <Input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. Urban busy professionals 28-45 seeking premium results"
                  className="text-xs"
                />
              </div>
            </div>

            {/* Options */}
            <div className="p-3.5 rounded-xl border bg-card/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">Auto-Draft Meta Ad Campaign</p>
                <p className="text-[11px] text-muted-foreground">
                  Transforms winning organic angle into an ad set ready in Meta Ads Manager
                </p>
              </div>
              <Switch checked={draftAd} onCheckedChange={setDraftAd} />
            </div>

            {isPending && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-primary font-semibold text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Autonomous Flywheel Running... Executing multi-agent pipeline</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Researching live trends → Writing Reel & Carousel → Auto-scheduling to calendar → Staging ad
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Results View */
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                  Flywheel Execution Successful!
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result.summary}
                </p>
              </div>
            </div>

            {/* Generated Content Items */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Synthesized & Scheduled Assets
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {result.contentPieces?.map((item: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg border bg-card/70 space-y-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {item.type}
                    </Badge>
                    <p className="text-xs font-semibold text-foreground line-clamp-1">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-3">{item.previewText}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Meta Ad Draft */}
            {result.metaCampaignCreated && (
              <div className="p-3.5 rounded-xl border bg-muted/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Megaphone className="size-3.5 text-primary" />
                    Meta Ad Campaign Staged
                  </span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                    Draft Created
                  </Badge>
                </div>
                <p className="text-xs font-bold text-foreground">{result.metaCampaignCreated.name}</p>
                <p className="text-xs text-muted-foreground">
                  Headline: &ldquo;{result.metaCampaignCreated.headline}&rdquo; · Daily Budget: ₹{result.metaCampaignCreated.dailyBudget}
                </p>
              </div>
            )}

            {/* Action Links */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href="/schedule" onClick={() => onOpenChange(false)} className="w-full">
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <Calendar className="size-3.5" /> View Calendar ({result.postsScheduledCount} Scheduled)
                </Button>
              </Link>
              <Link href="/meta-ads" onClick={() => onOpenChange(false)} className="w-full">
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <Megaphone className="size-3.5" /> Review Meta Ads
                </Button>
              </Link>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!result ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => launchFlywheel()}
                disabled={isPending || !niche.trim()}
                className="gap-2 font-bold"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Running Flywheel...
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5" /> Launch Autonomous Flywheel
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Run Another Campaign
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
