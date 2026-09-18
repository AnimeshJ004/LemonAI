"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface HumanTakeoverBannerProps {
  isAIActive: boolean;
  onToggle: (nextState: boolean) => void;
  disabled?: boolean;
}

export function HumanTakeoverBanner({
  isAIActive,
  onToggle,
  disabled,
}: HumanTakeoverBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-colors gap-2 sm:gap-4 w-full min-w-0 shrink-0",
        isAIActive
          ? "bg-primary/5 border-primary/20 text-foreground"
          : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
      )}
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
        {isAIActive ? (
          <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0 mt-0.5 sm:mt-0">
            <Bot className="size-4" />
          </div>
        ) : (
          <div className="size-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
            <UserCheck className="size-4" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-xs font-bold truncate">
              {isAIActive ? "AI Autopilot Active" : "Human Agent Takeover"}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "h-4 text-[9px] sm:text-[10px] px-1 font-semibold uppercase shrink-0",
                isAIActive
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30"
              )}
            >
              {isAIActive ? "Autonomous" : "AI Paused"}
            </Badge>
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1 sm:line-clamp-none leading-snug">
            {isAIActive
              ? "The AI assistant replies automatically using your brand memory."
              : "AI auto-responses are paused for this conversation."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground hidden sm:inline-block">
          {isAIActive ? "Pause AI" : "Resume AI"}
        </span>
        <Switch
          checked={isAIActive}
          onCheckedChange={onToggle}
          disabled={disabled}
          aria-label="Toggle AI control"
        />
      </div>
    </div>
  );
}
