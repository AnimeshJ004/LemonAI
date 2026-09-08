"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignStatusBadge } from "./campaign-status-badge";
import { SyncToCalendarButton } from "./sync-to-calendar-button";
import { EditCampaignDialog } from "./edit-campaign-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone,
  Search,
  ExternalLink,
  IndianRupee,
  Calendar,
  Sparkles,
  Plus,
  Rocket,
  Pencil,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: "Lead Gen",
  OUTCOME_SALES: "Sales",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_AWARENESS: "Awareness",
};

interface CampaignsTableProps {
  onCreateClick: () => void;
}

export function CampaignsTable({ onCreateClick }: CampaignsTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["meta-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/meta/campaigns");
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meta/campaigns/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete campaign");
      return json;
    },
    onSuccess: () => {
      toast.success("Campaign deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns"] });
      setCampaignToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete campaign");
      setCampaignToDelete(null);
    },
  });

  const campaigns = (data?.campaigns || []) as any[];

  const filtered = campaigns.filter((c) => {
    const matchesSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.ad_headline?.toLowerCase().includes(search.toLowerCase()) ||
      c.objective?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || c.status?.toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9 bg-card"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs h-9 rounded-md border border-border bg-card px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DRAFT">Draft</option>
            <option value="PAUSED">Paused</option>

          </select>

          <Button
            size="sm"
            onClick={onCreateClick}
            className="gap-1.5 text-xs font-semibold h-9 shadow-xs"
          >
            <Plus className="size-4" /> Create Campaign
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Megaphone className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {search || statusFilter !== "ALL"
                  ? "No matching campaigns found"
                  : "No Meta Ad Campaigns Created Yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {search || statusFilter !== "ALL"
                  ? "Try clearing your search query or status filter."
                  : "Launch your first AI-generated Meta Ad campaign in minutes using your saved Brand Profile."}
              </p>
            </div>
            {!search && statusFilter === "ALL" && (
              <Button
                size="sm"
                onClick={onCreateClick}
                className="gap-1.5 text-xs font-semibold mt-2"
              >
                <Sparkles className="size-3.5" /> Launch AI Campaign
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Campaign & Ad Creative</th>
                  <th className="py-3 px-3">Objective</th>
                  <th className="py-3 px-3">Daily Budget</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date Range</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filtered.map((item) => {
                  const previewUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${(
                    item.meta_ad_account_id || "act_000000000"
                  ).replace("act_", "")}`;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Campaign Name & Creative preview */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-3">
                          {item.ad_image_url ? (
                            <img
                              src={item.ad_image_url}
                              alt={item.name}
                              className="size-10 rounded-lg object-cover border shrink-0"
                            />
                          ) : (
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                              <ImageIcon className="size-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {item.ad_headline || item.ad_primary_text || "AI Optimized Copy"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Objective */}
                      <td className="py-3.5 px-3">
                        <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                          {OBJECTIVE_LABELS[item.objective] || item.objective}
                        </span>
                      </td>

                      {/* Budget */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-foreground">
                          ₹{Number(item.daily_budget || 1000).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-normal ml-0.5">
                          /day
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <CampaignStatusBadge status={item.status || "DRAFT"} />
                      </td>

                      {/* Dates */}
                      <td className="py-3.5 px-3 text-[11px] text-muted-foreground">
                        {item.start_date ? (
                          <span>
                            {format(new Date(item.start_date), "MMM d")}
                            {item.end_date ? ` - ${format(new Date(item.end_date), "MMM d")}` : ""}
                          </span>
                        ) : (
                          <span>Continuous</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs gap-1 hover:border-primary hover:text-primary transition-all"
                            onClick={() => setEditingCampaign(item)}
                            title="Edit Campaign"
                          >
                            <Pencil className="size-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 transition-all"
                            onClick={() => setCampaignToDelete(item)}
                            title="Delete Campaign"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>

                          {/* Ads Manager Link */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs gap-1"
                            onClick={() => window.open(previewUrl, "_blank")}
                            title="Open in Meta Ads Manager"
                          >
                            <ExternalLink className="size-3.5" />
                            <span className="hidden sm:inline">Ads Manager</span>
                          </Button>

                          {/* Sync to Calendar */}
                          <SyncToCalendarButton
                            content={`${item.ad_headline || item.name}\n\n${item.ad_primary_text || ""}`}
                            imageUrl={item.ad_image_url}
                            scheduledAt={item.start_date ? new Date(item.start_date).toISOString() : new Date().toISOString()}
                            className="h-8 text-xs"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Campaign Dialog */}
      <EditCampaignDialog
        open={Boolean(editingCampaign)}
        onOpenChange={(open) => {
          if (!open) setEditingCampaign(null);
        }}
        campaign={editingCampaign}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={Boolean(campaignToDelete)}
        onOpenChange={(open) => {
          if (!open) setCampaignToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Delete Meta Ad Campaign?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{campaignToDelete?.name}</strong>?
              This action cannot be undone and will remove it from your campaigns list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs h-8 font-semibold gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (campaignToDelete?.id) {
                  deleteMutation.mutate(campaignToDelete.id);
                }
              }}
            >
              {deleteMutation.isPending && <Spinner className="size-3.5" />}
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
