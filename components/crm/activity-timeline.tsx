"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  StickyNote,
  ArrowRightLeft,
  Bot,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  lead_id: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface ActivityTimelineProps {
  leadId?: string; // if provided, filters to a single lead
  showAddNote?: boolean;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  note:         { icon: StickyNote,     color: "text-slate-600",   bg: "bg-slate-500/10",   label: "Note" },
  call:         { icon: Phone,           color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Call" },
  email:        { icon: Mail,            color: "text-blue-600",    bg: "bg-blue-500/10",    label: "Email" },
  dm:           { icon: MessageSquare,   color: "text-purple-600",  bg: "bg-purple-500/10",  label: "DM" },
  whatsapp:     { icon: MessageSquare,   color: "text-green-600",   bg: "bg-green-500/10",   label: "WhatsApp" },
  bot_chat:     { icon: Bot,             color: "text-indigo-600",  bg: "bg-indigo-500/10",  label: "Bot Chat" },
  appointment:  { icon: Calendar,        color: "text-amber-600",   bg: "bg-amber-500/10",   label: "Appointment" },
  stage_change: { icon: ArrowRightLeft,  color: "text-rose-600",    bg: "bg-rose-500/10",    label: "Stage Change" },
};

export function ActivityTimeline({ leadId, showAddNote = false }: ActivityTimelineProps) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const queryKey = leadId ? ["crm-activities", leadId] : ["crm-activities"];

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const url = leadId
        ? `/api/crm/activities?lead_id=${encodeURIComponent(leadId)}&limit=50`
        : `/api/crm/activities?limit=100`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!leadId) throw new Error("No lead selected");
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          type: "note",
          title: noteTitle || "Manual Note",
          description: noteText,
        }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Note added to activity log");
      setNoteTitle("");
      setNoteText("");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: any) => toast.error(err.message || "Failed to add note"),
  });

  const activities: Activity[] = data?.activities || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="size-4 text-primary" /> Activity Timeline
          <Badge variant="outline" className="text-[10px]">{activities.length} events</Badge>
        </h3>
        <div className="flex items-center gap-2">
          {showAddNote && leadId && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setIsAdding((v) => !v)}>
              <Plus className="size-3" /> Add Note
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={cn("size-3", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Inline Add Note */}
      {isAdding && (
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <Input
            placeholder="Note title (e.g. Follow-up call scheduled)"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="text-xs h-8"
          />
          <Textarea
            placeholder="Add details about this interaction..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            className="text-xs resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-7" onClick={() => addNote.mutate()} disabled={addNote.isPending || !noteText.trim()}>
              {addNote.isPending ? "Saving..." : "Save Note"}
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          <Clock className="size-6 mx-auto mb-2 opacity-40" />
          <p>No activity logged yet.</p>
          <p className="mt-1">Activities are logged automatically from calls, DMs, and chatbot conversations.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/60" />

          <div className="space-y-3 pl-10">
            {activities.map((activity) => {
              const cfg = TYPE_CONFIG[activity.type] || TYPE_CONFIG.note;
              const Icon = cfg.icon;
              return (
                <div key={activity.id} className="relative">
                  {/* Icon dot */}
                  <div className={cn(
                    "absolute -left-[2.3rem] top-2 size-7 rounded-full flex items-center justify-center border border-border/60 bg-background",
                    cfg.bg
                  )}>
                    <Icon className={cn("size-3.5", cfg.color)} />
                  </div>

                  <div className="p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", cfg.color)}>
                            {cfg.label}
                          </Badge>
                          <p className="text-xs font-semibold text-foreground truncate">{activity.title}</p>
                        </div>
                        {activity.description && (
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{activity.description}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                        {new Date(activity.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                        {new Date(activity.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
