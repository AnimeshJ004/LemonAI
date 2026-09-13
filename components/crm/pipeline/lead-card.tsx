"use client";

import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreVertical,
  Edit2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  lead: Lead;
  index: number;
  onClick: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
}

export function LeadCard({ lead, index, onClick, onDelete }: LeadCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      case "instagram":
        return <span className="size-2 rounded-full bg-pink-500 inline-block" />;
      case "facebook":
        return <span className="size-2 rounded-full bg-blue-600 inline-block" />;
      case "whatsapp":
        return <MessageSquare className="size-3 text-emerald-500" />;
      case "meta_ads":
        return <Sparkles className="size-3 text-purple-500" />;
      case "voice":
      case "inbound_call":
        return <Phone className="size-3 text-amber-500" />;
      case "website":
      default:
        return <Globe className="size-3 text-sky-500" />;
    }
  };

  const formattedDeal = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(lead.deal_value) || 0);

  return (
    <>
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
                {/* Top Row: Source, Score & Action Menu */}
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

                  <div className="flex items-center gap-1">
                    <div
                      className={cn(
                        "text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1",
                        scoreBadgeColor
                      )}
                      title={
                        lead.metadata?.bant
                          ? `BANT: Budget ${lead.metadata.bant.budgetScore}, Authority ${lead.metadata.bant.authorityScore}, Need ${lead.metadata.bant.needScore}, Timing ${lead.metadata.bant.timingScore}`
                          : `BANT Score: ${score}/10`
                      }
                    >
                      <Sparkles className="size-2.5" />
                      <span>{score}/10</span>
                    </div>

                    {/* 3-dots actions menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onClick(lead);
                          }}
                          className="gap-2 text-xs"
                        >
                          <Edit2 className="size-3.5" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteDialog(true);
                          }}
                          className="gap-2 text-xs text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          Delete Lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {lead.metadata?.bant && (
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded border border-border/40">
                    <span>B:{lead.metadata.bant.budgetScore}</span>
                    <span>•</span>
                    <span>A:{lead.metadata.bant.authorityScore}</span>
                    <span>•</span>
                    <span>N:{lead.metadata.bant.needScore}</span>
                    <span>•</span>
                    <span>T:{lead.metadata.bant.timingScore}</span>
                  </div>
                )}

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

                {/* Deal Value, Booking indicator & Quick Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center font-semibold text-foreground">
                      <DollarSign className="size-3.5 text-muted-foreground -mr-1" />
                      <span>{formattedDeal}</span>
                    </div>

                    {lead.metadata?.bookingInfo?.scheduledAt ? (
                      <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                        <Calendar className="size-3" />
                        <span>Booked</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Explicit Edit & Delete Action Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px] font-semibold gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick(lead);
                      }}
                      title="Edit prospect details"
                    >
                      <Edit2 className="size-2.5" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteDialog(true);
                      }}
                      title="Delete prospect"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Draggable>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead &quot;{lead.name || "Prospect"}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this prospect from your pipeline? This action will permanently remove the lead card and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteDialog(false);
                if (onDelete) onDelete(lead);
              }}
            >
              Delete Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
