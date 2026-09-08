"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/lib/crm-service";
import {
  Globe,
  Phone,
  MessageSquare,
  Sparkles,
  DollarSign,
  Building2,
  Calendar,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  lead: Lead;
  index: number;
  onClick: (lead: Lead) => void;
}

export function LeadCard({ lead, index, onClick }: LeadCardProps) {
  // Score styling
  const score = lead.score ?? 5;
  const isHighIntent = score >= 8;
  const isMediumIntent = score >= 5 && score < 8;

  const scoreBadgeColor = isHighIntent
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    : isMediumIntent
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
    : "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";

  // Channel Icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case "website":
        return <Globe className="size-3 text-sky-500" />;
      case "whatsapp":
        return <MessageSquare className="size-3 text-emerald-500" />;
      case "meta_ads":
        return <Sparkles className="size-3 text-purple-500" />;
      case "voice":
      case "inbound_call":
        return <Phone className="size-3 text-amber-500" />;
      default:
        return <Globe className="size-3 text-muted-foreground" />;
    }
  };

  const formattedDeal = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(lead.deal_value) || 0);

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="group mb-2.5 outline-none"
        >
          <Card
            onClick={() => onClick(lead)}
            className={cn(
              "cursor-pointer border border-border/70 bg-card hover:border-primary/50 transition-all duration-150 shadow-xs hover:shadow-md",
              snapshot.isDragging && "shadow-xl border-primary ring-2 ring-primary/20 rotate-1 scale-[1.02]"
            )}
          >
            <CardContent className="p-3.5 space-y-2.5">
              {/* Top Row: Source & Score */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] font-medium capitalize gap-1 bg-muted/40"
                  >
                    {getSourceIcon(lead.source)}
                    <span>{lead.source.replace("_", " ")}</span>
                  </Badge>
                  {isHighIntent && (
                    <Badge className="h-5 px-1.5 text-[10px] bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-semibold gap-0.5">
                      <Flame className="size-2.5" />
                      Hot
                    </Badge>
                  )}
                </div>

                <div
                  className={cn(
                    "text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1",
                    scoreBadgeColor
                  )}
                  title={`BANT Score: ${score}/10`}
                >
                  <span>{score}/10</span>
                </div>
              </div>

              {/* Lead Name & Company */}
              <div>
                <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {lead.name || "Anonymous Prospect"}
                </h4>
                {lead.metadata?.company ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 line-clamp-1">
                    <Building2 className="size-3 shrink-0" />
                    <span>{lead.metadata.company}</span>
                  </p>
                ) : lead.email ? (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {lead.email}
                  </p>
                ) : null}
              </div>

              {/* Deal Value & Booking indicator */}
              <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                <div className="flex items-center gap-1 font-semibold text-foreground">
                  <DollarSign className="size-3.5 text-muted-foreground -mr-1" />
                  <span>{formattedDeal}</span>
                </div>

                {lead.metadata?.bookingInfo?.scheduledAt ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <Calendar className="size-3" />
                    Booked
                  </span>
                ) : lead.phone ? (
                  <span className="text-[11px] text-muted-foreground">
                    {lead.phone}
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}
