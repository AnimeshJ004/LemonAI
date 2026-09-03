"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SyncToCalendarButtonProps {
  content: string;
  imageUrl?: string;
  scheduledAt?: string;
  channelTypeId?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  onSuccess?: () => void;
}

export function SyncToCalendarButton({
  content,
  imageUrl,
  scheduledAt,
  channelTypeId,
  className,
  variant = "outline",
  onSuccess,
}: SyncToCalendarButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleSync = async () => {
    if (!scheduledAt) {
      toast.error("Please set a schedule date first.");
      return;
    }
    if (!content?.trim()) {
      toast.error("No content to schedule.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/meta/sync-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, imageUrl, scheduledAt, channelTypeId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to sync");
      }

      setStatus("success");
      toast.success("Post added to your organic schedule! 📅", {
        description: "Check your Schedule calendar to manage it.",
        duration: 5000,
      });
      onSuccess?.();

      // Reset after 3s
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("idle");
      toast.error(err instanceof Error ? err.message : "Failed to sync to calendar");
    }
  };

  return (
    <Button
      id="sync-to-calendar-btn"
      variant={variant}
      size="sm"
      className={cn(
        "gap-2 transition-all",
        status === "success" && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
        className
      )}
      onClick={handleSync}
      disabled={status === "loading" || status === "success"}
    >
      {status === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : status === "success" ? (
        <Check className="size-4" />
      ) : (
        <Calendar className="size-4" />
      )}
      {status === "success" ? "Added to Calendar!" : "Add to Schedule Calendar"}
    </Button>
  );
}
