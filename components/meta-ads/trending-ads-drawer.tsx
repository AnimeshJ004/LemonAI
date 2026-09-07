"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Zap } from "lucide-react";

interface TrendingAdsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  niche: string;
  country: string;
  onModelAd?: (ad: any) => void;
}

export default function TrendingAdsDrawer({ open, onOpenChange, niche, country, onModelAd }: TrendingAdsDrawerProps) {
  const [ads, setAds] = useState<any[]>([]);

  const { mutate: fetchAds, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meta/trending-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche || "ecommerce", country: country || "IN" }),
      });
      if (!res.ok) throw new Error("Failed to fetch ads");
      return res.json();
    },
    onSuccess: (data) => setAds(data.ads || []),
    onError: () => toast.error("Failed to fetch competitor ads"),
  });

  const spendColors: Record<string, string> = {
    HIGH: "text-red-500 border-red-200 bg-red-50 dark:bg-red-950/30",
    MEDIUM: "text-amber-500 border-amber-200 bg-amber-50 dark:bg-amber-950/30",
    LOW: "text-green-500 border-green-200 bg-green-50 dark:bg-green-950/30"
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (o && ads.length === 0) fetchAds(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" /> Live Competitor Ads
          </SheetTitle>
          <p className="text-sm text-muted-foreground">Top performing ads in "{niche || "ecommerce"}" right now</p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isPending ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))
          ) : ads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No ads loaded yet</p>
              <Button onClick={() => fetchAds()} className="mt-2" variant="outline">Fetch Ads</Button>
            </div>
          ) : (
            ads.map((ad, i) => (
              <div key={ad.id || i} className="p-4 rounded-lg border space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{ad.advertiserName}</p>
                    <p className="font-semibold text-sm mt-0.5">{ad.headline}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${spendColors[ad.estimatedSpendTier] || ""}`}>
                    💰 {ad.estimatedSpendTier}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{ad.primaryText}</p>
                {ad.whyItWorks && (
                  <p className="text-xs bg-primary/5 border border-primary/20 rounded p-2">
                    <span className="font-medium text-primary">Why it works:</span> {ad.whyItWorks}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {ad.platforms?.map((p: string) => (
                    <Badge key={p} variant="secondary" className="text-xs capitalize">{p}</Badge>
                  ))}
                  {onModelAd && (
                    <Button
                      size="sm"
                      className="ml-auto text-xs h-7 gap-1"
                      onClick={() => {
                        onModelAd(ad);
                        onOpenChange(false);
                        toast.success("Ad loaded into wizard!");
                      }}
                    >
                      <Zap className="size-3" /> Model This Ad
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
