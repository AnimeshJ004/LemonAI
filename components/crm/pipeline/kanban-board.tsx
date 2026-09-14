"use client";

import React, { useState, useEffect, useRef } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { KanbanColumn, StageConfig } from "./kanban-column";
import type { Lead, LeadStage } from "@/lib/crm-service";
import { LeadDetailDialog } from "./lead-detail-dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const CRM_STAGES: StageConfig[] = [
  {
    id: "new",
    label: "New Leads",
    color: "slate",
    dotColor: "bg-slate-400",
  },
  {
    id: "contacted",
    label: "Contacted",
    color: "blue",
    dotColor: "bg-sky-500",
  },
  {
    id: "qualified",
    label: "Qualified (BANT)",
    color: "amber",
    dotColor: "bg-amber-500",
  },
  {
    id: "booked",
    label: "Appointment Booked",
    color: "purple",
    dotColor: "bg-purple-500",
  },
  {
    id: "proposal",
    label: "Proposal Sent",
    color: "indigo",
    dotColor: "bg-indigo-500",
  },
  {
    id: "closed_won",
    label: "Closed Won",
    color: "emerald",
    dotColor: "bg-emerald-500",
  },
  {
    id: "closed_lost",
    label: "Closed Lost",
    color: "rose",
    dotColor: "bg-rose-500",
  },
];

interface KanbanBoardProps {
  initialLeads: Lead[];
  onLeadsChange?: (leads: Lead[]) => void;
  onAddLead?: (stage: LeadStage) => void;
}

export function KanbanBoard({ initialLeads, onLeadsChange, onAddLead }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeStageTab, setActiveStageTab] = useState<LeadStage>("new");
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const scrollToStage = (stageId: LeadStage) => {
    setActiveStageTab(stageId);
    if (!scrollContainerRef.current) return;
    const targetEl = document.getElementById(`kanban-col-${stageId}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStage = destination.droppableId as LeadStage;
    const targetLead = leads.find((l) => l.id === draggableId);
    if (!targetLead) return;

    // Optimistic UI state update
    const updatedList = leads.map((l) =>
      l.id === draggableId ? { ...l, stage: newStage, updated_at: new Date().toISOString() } : l
    );

    setLeads(updatedList);
    if (onLeadsChange) onLeadsChange(updatedList);

    // Call API in background
    try {
      const res = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draggableId,
          stage: newStage,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save new stage");
      }
      toast.success(`Moved ${targetLead.name || "lead"} to ${newStage.replace("_", " ")}`);

      // Log stage-change activity
      fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: draggableId,
          type: "stage_change",
          title: `Pipeline moved to ${newStage.replace("_", " ")}`,
          description: `Drag-and-drop: ${source.droppableId.replace("_", " ")} → ${newStage.replace("_", " ")}`,
        }),
      }).catch(() => {});
    } catch {
      toast.error("Could not persist stage change. Reverting.");
      // Rollback
      setLeads(initialLeads);
    }
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleLeadUpdated = (updated: Lead) => {
    const newList = leads.map((l) => (l.id === updated.id ? updated : l));
    setLeads(newList);
    setSelectedLead(updated);
    if (onLeadsChange) onLeadsChange(newList);
  };

  const handleLeadDeletedById = (leadId: string) => {
    const newList = leads.filter((l) => l.id !== leadId);
    setLeads(newList);
    setSelectedLead(null);
    setIsDetailOpen(false);
    if (onLeadsChange) onLeadsChange(newList);
  };

  const handleLeadDeleteDirect = async (lead: Lead) => {
    try {
      const res = await fetch(`/api/crm/leads?id=${lead.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete lead");

      handleLeadDeletedById(lead.id);
      toast.success(`Deleted prospect "${lead.name || "Lead"}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    }
  };

  if (!isMounted) {
    return (
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1">
        {CRM_STAGES.map((stage) => (
          <div
            key={stage.id}
            className="w-[85vw] max-w-[280px] sm:w-[280px] shrink-0 h-[520px] rounded-xl bg-muted/20 animate-pulse border border-border/40"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile Stage Quick-Navigation Pills */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {CRM_STAGES.map((stage) => {
          const count = leads.filter((l) => l.stage === stage.id).length;
          const isActive = activeStageTab === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => scrollToStage(stage.id as LeadStage)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted border-border text-muted-foreground"
              }`}
            >
              <span className={`size-2 rounded-full ${stage.dotColor}`} />
              <span>{stage.label}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Main Kanban Board Scroll Area */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          ref={scrollContainerRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto pb-6 pt-1 select-none snap-x snap-mandatory sm:snap-none scrollbar-thin touch-pan-x"
        >
          {CRM_STAGES.map((stage) => {
            const columnLeads = leads.filter((l) => l.stage === stage.id);
            return (
              <div
                key={stage.id}
                id={`kanban-col-${stage.id}`}
                className="snap-start shrink-0 w-[85vw] max-w-[300px] sm:w-[300px]"
              >
                <KanbanColumn
                  stage={stage}
                  leads={columnLeads}
                  onLeadClick={handleLeadClick}
                  onLeadDelete={handleLeadDeleteDirect}
                  onAddLead={onAddLead}
                />
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Lead Edit & Details Modal */}
      <LeadDetailDialog
        lead={selectedLead}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdate={handleLeadUpdated}
        onDelete={handleLeadDeletedById}
      />
    </div>
  );
}