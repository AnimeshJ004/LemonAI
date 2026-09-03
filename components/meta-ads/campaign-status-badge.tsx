"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type CampaignStatus = "DRAFT" | "IN_REVIEW" | "ACTIVE" | "PAUSED" | "ARCHIVED";

interface CampaignStatusBadgeProps {
  status: CampaignStatus | string;
  className?: string;
  showPulse?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; pulse: boolean }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
    pulse: false,
  },
  IN_REVIEW: {
    label: "In Review",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    pulse: true,
  },
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    pulse: true,
  },
  PAUSED: {
    label: "Paused",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    pulse: false,
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-muted/50 text-muted-foreground/70 border-border",
    pulse: false,
  },
};

const PULSE_COLORS: Record<string, string> = {
  IN_REVIEW: "bg-amber-500",
  ACTIVE: "bg-emerald-500",
};

export function CampaignStatusBadge({
  status,
  className,
  showPulse = true,
}: CampaignStatusBadgeProps) {
  const normalized = status?.toUpperCase().replace(/ /g, "_") ?? "DRAFT";
  const config = STATUS_CONFIG[normalized] ?? STATUS_CONFIG.DRAFT;
  const pulseColor = PULSE_COLORS[normalized];
  const shouldPulse = showPulse && config.pulse;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 select-none",
        config.className,
        className
      )}
    >
      {shouldPulse && pulseColor ? (
        <span className="relative flex size-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              pulseColor
            )}
          />
          <span className={cn("relative inline-flex size-2 rounded-full", pulseColor)} />
        </span>
      ) : (
        <span
          className={cn(
            "size-2 rounded-full",
            normalized === "DRAFT" ? "bg-muted-foreground/50" :
            normalized === "PAUSED" ? "bg-blue-500" :
            "bg-muted-foreground/30"
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}
