"use client";

import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import type { Lead, LeadStage } from "@/lib/crm-service";
import { LeadCard } from "./lead-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageConfig {
  id: LeadStage;
  label: string;
  color: string;
  dotColor: string;
}

interface KanbanColumnProps {
  stage: StageConfig;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadDelete?: (lead: Lead) => void;
  onAddLead?: (stage: LeadStage) => void;
}

export function KanbanColumn({
  stage,
  leads,
  onLeadClick,
  onLeadDelete,
  onAddLead,
}: KanbanColumnProps) {
  const columnTotal = leads.reduce((acc, l) => acc + (Number(l.deal_value) || 0), 0);

  const formattedTotal = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(columnTotal);

  return (
    <div className="flex flex-col flex-1 min-w-[280px] max-w-[340px] bg-muted/30 rounded-xl p-2.5 border border-border/60">
      {/* Column Header */}
      <div className="flex items-center justify-between px-1.5 pb-2.5 mb-1 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", stage.dotColor)} />
          <h3 className="font-semibold text-xs tracking-tight text-foreground">
            {stage.label}
          </h3>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[11px] font-semibold bg-background/80"
          >
            {leads.length}
          </Badge>

          {onAddLead && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAddLead(stage.id)}
              className="size-5 ml-0.5 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded"
              title={`Add lead to ${stage.label}`}
            >
              <Plus className="size-3" />
            </Button>
          )}
        </div>

        <span className="text-[11px] font-semibold text-muted-foreground">
          {formattedTotal}
        </span>
      </div>

      {/* Droppable Card Container */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 min-h-[480px] rounded-lg transition-colors p-1",
              snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary/20"
            )}
          >
            {leads.map((lead, index) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                index={index}
                onClick={onLeadClick}
                onDelete={onLeadDelete}
              />
            ))}
            {provided.placeholder}

            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center h-36 border border-dashed border-border/60 rounded-lg text-center p-3 text-muted-foreground/60 text-xs">
                <span>No leads in {stage.label.toLowerCase()}</span>
                {onAddLead && (
                  <button
                    type="button"
                    onClick={() => onAddLead(stage.id)}
                    className="mt-1.5 text-[11px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    + Add prospect
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
