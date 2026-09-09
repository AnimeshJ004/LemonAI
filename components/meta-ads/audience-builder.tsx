"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Target,
  Sparkles,
  Layers,
  Globe,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface Audience {
  id: string;
  name: string;
  type: string;
  description?: string;
  targeting?: {
    interests?: string[];
    locations?: string[];
    age_min?: number;
    age_max?: number;
    gender?: string;
  };
  approximate_count?: number;
  status: string;
  created_at: string;
}

export function AudienceBuilder() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"INTEREST" | "LOOKALIKE" | "WEBSITE_RETARGETING" | "CUSTOMER_LIST">("INTEREST");
  const [description, setDescription] = useState("");
  const [interests, setInterests] = useState("Entrepreneurship, Small Business, Digital Marketing");
  const [locations, setLocations] = useState("India, United States");
  const [ageMin, setAgeMin] = useState("21");
  const [ageMax, setAgeMax] = useState("55");
  const [gender, setGender] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["meta-audiences"],
    queryFn: async () => {
      const res = await fetch("/api/meta/audiences");
      if (!res.ok) return { audiences: [] };
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        type,
        description,
        interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
        locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
        ageMin: Number(ageMin) || 18,
        ageMax: Number(ageMax) || 65,
        gender,
      };

      const res = await fetch("/api/meta/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create audience");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Meta Audience created successfully!");
      setOpen(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["meta-audiences"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create audience");
    },
  });

  const storedAudiences: Audience[] = data?.audiences || [];
  const liveAudiences: any[] = data?.liveAudiences || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="size-4 text-primary" /> Meta Custom Audiences & Targeting
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build high-ROAS Lookalikes, Interest Segments & Retargeting pools for your AI campaigns
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs gap-1.5 font-semibold">
              <Plus className="size-3.5" /> Create Audience
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> New Meta Custom Audience
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Audience Name *</label>
                <Input
                  placeholder="e.g. High-Ticket SaaS Buyers (1% Lookalike)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Audience Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "INTEREST", label: "Interest-Based", icon: Compass },
                    { id: "LOOKALIKE", label: "1% Lookalike", icon: Sparkles },
                    { id: "WEBSITE_RETARGETING", label: "Website Pixel", icon: Globe },
                    { id: "CUSTOMER_LIST", label: "CRM Lead Pool", icon: Users },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id as any)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          type === t.id
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {type === "INTEREST" && (
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Interests & Behaviors (comma separated)</label>
                  <Input
                    placeholder="e.g. Entrepreneurship, SaaS, B2B Marketing"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Locations</label>
                  <Input
                    placeholder="e.g. India, United States"
                    value={locations}
                    onChange={(e) => setLocations(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                  >
                    <option value="ALL">All Genders</option>
                    <option value="MEN">Men</option>
                    <option value="WOMEN">Women</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Age Min</label>
                  <Input
                    type="number"
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Age Max</label>
                  <Input
                    type="number"
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Description / Purpose</label>
                <Textarea
                  placeholder="Targeting notes for AI campaign optimization..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs h-16 resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="h-8 text-xs gap-1"
              >
                {createMutation.isPending ? "Creating..." : "Save Audience"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Audiences List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
        ) : storedAudiences.length === 0 && liveAudiences.length === 0 ? (
          <div className="col-span-2 text-center py-10 rounded-2xl border border-dashed p-6 space-y-2">
            <Users className="size-8 mx-auto text-muted-foreground opacity-50" />
            <p className="text-sm font-semibold">No Custom Audiences Created Yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create your first audience to feed calibrated targeting into your Meta Ads and scale winning campaigns.
            </p>
            <Button
              size="sm"
              onClick={() => setOpen(true)}
              className="text-xs gap-1 mt-2"
            >
              <Plus className="size-3.5" /> Create Audience
            </Button>
          </div>
        ) : (
          [...storedAudiences, ...liveAudiences].map((aud, i) => (
            <Card key={aud.id || i} className="hover:shadow-xs transition-shadow">
              <CardContent className="pt-4 pb-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">{aud.name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {aud.description || "Audience configured for Meta Advertising"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                    {aud.type?.replace("_", " ").toLowerCase() || "Custom"}
                  </Badge>
                </div>

                {aud.targeting?.interests && aud.targeting.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {aud.targeting.interests.slice(0, 3).map((item: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                    {aud.targeting.interests.length > 3 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{aud.targeting.interests.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                  <span>Age {aud.targeting?.age_min || 18} - {aud.targeting?.age_max || 65}</span>
                  <span className="text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="size-3" /> Ready for Ads
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
