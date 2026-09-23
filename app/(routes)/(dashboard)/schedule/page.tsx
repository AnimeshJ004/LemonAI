"use client"

import { Suspense, useState } from "react";
import { useQueryState } from "nuqs"
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarIcon, LayoutList, Plus } from "lucide-react";
import ListView from "@/components/schedule/list-view";
import CalendarView from "@/components/schedule/calendar-view";
import CreatePostDialog from "@/components/schedule/create-post-dialog";
import { ModernLoader } from "@/components/ui/modern-loader";

import { cn } from "@/lib/utils";

type ViewType = "calendar" | "list"

const SchedulePageContent = () => {
  const [activeView, setActiveView] = useQueryState("view", {
    defaultValue: "calendar",
  });
  const [_, setStatus] = useQueryState("status", {
    defaultValue: "",
  });
  const [createPostModalOpen, setCreatePostModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full w-full min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-1 sm:px-4 pt-1 pb-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-foreground">Schedule Workspace</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 md:line-clamp-none">
              Plan, draft, and schedule posts across all connected channels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ToggleGroup
            type="single"
            value={activeView}
            onValueChange={(value) => {
              if (value) {
                setStatus(null);
                setActiveView(value as ViewType);
              }
            }}
            className="border rounded-lg p-0.5 bg-muted/30"
          >
            <ToggleGroupItem value="list" className="gap-1.5 px-3 min-h-[40px] sm:min-h-[36px] h-9 sm:h-8">
              <LayoutList className="size-4" />
              <span className="text-xs font-medium">List</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" className="gap-1.5 px-3 min-h-[40px] sm:min-h-[36px] h-9 sm:h-8">
              <CalendarIcon className="size-4" />
              <span className="text-xs font-medium">Calendar</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            onClick={() => setCreatePostModalOpen(true)}
            className="gap-1.5 font-semibold text-xs sm:text-sm min-h-[40px] sm:min-h-[36px] h-9 sm:h-8 px-3.5 shrink-0 shadow-xs"
          >
            <Plus className="size-4" />
            <span>New Post</span>
          </Button>
        </div>
      </header>

      {/* Main View Container: Fluid down to 320px for List View, scrollable for Calendar */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-x-auto overflow-y-auto pt-2">
        <div className={cn("h-full flex flex-col min-h-0", activeView === "calendar" ? "min-w-[650px] md:min-w-0" : "w-full min-w-0")}>
          {activeView === "list" ? (
            <ListView setCreatePostModalOpen={setCreatePostModalOpen} />
          ) : (
            <CalendarView />
          )}
        </div>
      </div>

      <CreatePostDialog 
        open={createPostModalOpen}
        onOpenChange={setCreatePostModalOpen}
      />
    </div>
  );
};

const SchedulePage = () => {
  return (
    <Suspense fallback={<ModernLoader showSkeleton label="Loading schedule" description="Preparing your calendar & content slots" />}>
      <NuqsAdapter>
        <SchedulePageContent />
      </NuqsAdapter>
    </Suspense>
  )
}

export default SchedulePage