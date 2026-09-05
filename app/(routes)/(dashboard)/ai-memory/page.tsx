"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import {
  Brain,
  Trash2,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  MessageSquare,
  Sparkles,
  Info,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
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

interface MemoryRow {
  id: string;
  signal_type: "positive" | "edited" | "deleted" | "explicit";
  original_content: string | null;
  final_content: string | null;
  feedback_text: string | null;
  learned_insight: string | null;
  context_niche: string | null;
  context_tone: string | null;
  created_at: string;
}

const SIGNAL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  positive: {
    label: "Liked",
    icon: ThumbsUp,
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
  },
  edited: {
    label: "Edited",
    icon: Pencil,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  },
  deleted: {
    label: "Deleted",
    icon: ThumbsDown,
    colorClass: "text-rose-600 dark:text-rose-400",
    bgClass: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
  },
  explicit: {
    label: "Feedback",
    icon: MessageSquare,
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  },
};

export default function AIMemoryPage() {
  const queryClient = useQueryClient();
  const [confirmReset, setConfirmReset] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-memory"],
    queryFn: async () => {
      const res = await fetch("/api/ai/memory");
      if (!res.ok) throw new Error("Failed to load AI memories");
      return res.json() as Promise<{ memories: MemoryRow[] }>;
    },
  });

  const memories = data?.memories || [];

  // ── Delete single memory ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/ai/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete memory");
    },
    onSuccess: () => {
      toast.success("Memory removed");
      queryClient.invalidateQueries({ queryKey: ["ai-memory"] });
      setDeletingId(null);
    },
    onError: () => toast.error("Failed to remove memory"),
  });

  // ── Reset ALL memories ──
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to reset memories");
    },
    onSuccess: () => {
      toast.success("All AI memories reset. Starting fresh!");
      queryClient.invalidateQueries({ queryKey: ["ai-memory"] });
      setConfirmReset(false);
    },
    onError: () => toast.error("Failed to reset memories"),
  });

  // Stats
  const positiveCount = memories.filter((m) => m.signal_type === "positive").length;
  const editedCount = memories.filter((m) => m.signal_type === "edited").length;
  const deletedCount = memories.filter((m) => m.signal_type === "deleted").length;
  const explicitCount = memories.filter((m) => m.signal_type === "explicit").length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Brain className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Memory</h1>
              <p className="text-sm text-muted-foreground">
                What your AI has learned from your feedback
              </p>
            </div>
          </div>
        </div>

        {memories.length > 0 && (
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="size-4 mr-1.5" />
            Reset All Memories
          </Button>
        )}
      </div>

      {/* ── How it works banner ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-foreground">How AI Memory Works</p>
          <p className="text-muted-foreground">
            Every time you <strong>like</strong> a post, <strong>edit</strong> it, or{" "}
            <strong>delete</strong> it, the AI learns your preferences. These learned insights are
            automatically injected into every future generation — making posts more personalized over
            time. Zero extra cost.
          </p>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Liked", count: positiveCount, icon: ThumbsUp, color: "text-emerald-500" },
          { label: "Edited", count: editedCount, icon: Pencil, color: "text-blue-500" },
          { label: "Deleted", count: deletedCount, icon: ThumbsDown, color: "text-rose-500" },
          { label: "Feedback", count: explicitCount, icon: MessageSquare, color: "text-amber-500" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-xl border bg-card flex items-center gap-3"
          >
            <stat.icon className={cn("size-5 shrink-0", stat.color)} />
            <div>
              <p className="text-xl font-bold text-foreground">{stat.count}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Memories List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <Brain className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No memories yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Start interacting with your posts — like, edit, or delete them — and the AI will begin
            learning your preferences automatically.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ThumbsUp className="size-3 text-emerald-500" /> Like a post
            </span>
            <ChevronRight className="size-3" />
            <span className="flex items-center gap-1">
              <Pencil className="size-3 text-blue-500" /> Edit its content
            </span>
            <ChevronRight className="size-3" />
            <span className="flex items-center gap-1">
              <Sparkles className="size-3 text-primary" /> AI improves
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {memories.length} learned insight{memories.length !== 1 ? "s" : ""}
          </p>

          {memories.map((memory) => {
            const config = SIGNAL_CONFIG[memory.signal_type] || SIGNAL_CONFIG.explicit;
            const Icon = config.icon;

            return (
              <div
                key={memory.id}
                className={cn(
                  "p-4 rounded-xl border space-y-3 transition-all",
                  config.bgClass
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        "size-8 rounded-lg bg-background border flex items-center justify-center shrink-0",
                        config.colorClass
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-bold", config.colorClass)}
                        >
                          {config.label}
                        </Badge>
                        {memory.context_niche && (
                          <span className="text-[10px] text-muted-foreground">
                            • {memory.context_niche}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="size-2.5" />
                          {formatDistanceToNow(parseISO(memory.created_at))} ago
                        </span>
                      </div>

                      {/* ── Learned insight ── */}
                      {memory.learned_insight && (
                        <p className="mt-1.5 text-sm font-medium text-foreground">
                          🧠 {memory.learned_insight}
                        </p>
                      )}

                      {/* ── Feedback text ── */}
                      {memory.feedback_text && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          "{memory.feedback_text}"
                        </p>
                      )}

                      {/* ── Content diff (edited) ── */}
                      {memory.signal_type === "edited" &&
                        memory.original_content &&
                        memory.final_content && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View before / after
                            </summary>
                            <div className="mt-2 grid sm:grid-cols-2 gap-2">
                              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                                <p className="text-[10px] font-bold text-rose-600 mb-1">BEFORE</p>
                                <p className="text-foreground/80 line-clamp-3">
                                  {memory.original_content}
                                </p>
                              </div>
                              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                                <p className="text-[10px] font-bold text-emerald-600 mb-1">AFTER</p>
                                <p className="text-foreground/80 line-clamp-3">
                                  {memory.final_content}
                                </p>
                              </div>
                            </div>
                          </details>
                        )}

                      {/* Positive content preview */}
                      {memory.signal_type === "positive" && memory.final_content && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {memory.final_content}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    id={`delete-memory-${memory.id}`}
                    onClick={() => setDeletingId(memory.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    title="Remove this memory"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Delete single memory confirm ── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              The AI will no longer use this learned insight in future generations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              Remove Memory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset ALL confirm ── */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all AI memories?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {memories.length} learned insights. The AI will start
              fresh with no personalization. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              Reset All Memories
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
