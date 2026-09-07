"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, UserCheck, AlertCircle } from "lucide-react";
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
        "flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors",
        isAIActive
          ? "bg-primary/5 border-primary/20 text-foreground"
          : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
      )}
    >
      <div className="flex items-center gap-2.5">
        {isAIActive ? (
          <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-primary">
            <Bot className="size-4" />
          </div>
        ) : (
          <div className="size-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <UserCheck className="size-4" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">
              {isAIActive ? "AI Autopilot Responding" : "Human Agent Takeover Active"}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "h-4 text-[10px] px-1 font-semibold uppercase",
                isAIActive
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30"
              )}
            >
              {isAIActive ? "Autonomous" : "AI Paused"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isAIActive
              ? "The AI assistant replies automatically using your brand memory."
              : "AI auto-responses are paused for this conversation."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline-block">
          {isAIActive ? "Pause AI" : "Resume AI"}
        </span>
        <Switch
          checked={isAIActive}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
