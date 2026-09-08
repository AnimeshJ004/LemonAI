"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { IndianRupee, Sparkles, Megaphone } from "lucide-react";

interface EditCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
}

const OBJECTIVE_OPTIONS = [
  { value: "OUTCOME_LEADS", label: "Lead Generation (Instant Forms / DMs)" },
  { value: "OUTCOME_SALES", label: "Direct Sales & Conversions" },
  { value: "OUTCOME_TRAFFIC", label: "Website Traffic" },
  { value: "OUTCOME_ENGAGEMENT", label: "Post Engagement & Page Likes" },
  { value: "OUTCOME_AWARENESS", label: "Brand Awareness & Maximum Reach" },
];

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
];

export function EditCampaignDialog({
  open,
  onOpenChange,
  campaign,
}: EditCampaignDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_LEADS");
  const [status, setStatus] = useState("DRAFT");
  const [dailyBudget, setDailyBudget] = useState(500);
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || "");
      setObjective(campaign.objective || "OUTCOME_LEADS");
      setStatus(campaign.status?.toUpperCase() || "DRAFT");
      setDailyBudget(Number(campaign.daily_budget) || 500);
      setHeadline(campaign.ad_headline || "");
      setPrimaryText(campaign.ad_primary_text || "");
      setStartDate(
        campaign.start_date
          ? new Date(campaign.start_date).toISOString().split("T")[0]
          : ""
      );
      setEndDate(
        campaign.end_date
          ? new Date(campaign.end_date).toISOString().split("T")[0]
          : ""
      );
    }
  }, [campaign]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!campaign?.id) throw new Error("Missing campaign ID");
      const res = await fetch(`/api/meta/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          objective,
          status,
          daily_budget: dailyBudget,
          ad_headline: headline,
          ad_primary_text: primaryText,
          start_date: startDate ? new Date(startDate).toISOString() : null,
          end_date: endDate ? new Date(endDate).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update campaign");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Campaign updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update campaign");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Megaphone className="size-4 text-primary" /> Edit Meta Ad Campaign
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Campaign Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Campaign Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Growth Lead Campaign"
              className="text-xs h-9"
              required
            />
          </div>

          {/* Objective & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Objective</Label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-border bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {OBJECTIVE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs h-9 rounded-md border border-border bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Daily Budget */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Daily Budget (₹ INR)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                ₹
              </span>
              <Input
                type="number"
                min="100"
                step="50"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(Number(e.target.value))}
                className="pl-7 text-xs h-9 font-semibold"
              />
            </div>
          </div>

          {/* Ad Headline */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ad Headline</Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Cut The Noise. Reclaim Focus."
              className="text-xs h-9"
            />
          </div>

          {/* Ad Primary Text */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ad Primary Text</Label>
            <Textarea
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              placeholder="Main ad body copy explaining the offer, value proposition, and call to action..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          {/* Schedule Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End Date (Optional)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateMutation.isPending}
              className="text-xs h-8 gap-1.5 font-semibold"
            >
              {updateMutation.isPending && <Spinner className="size-3.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
