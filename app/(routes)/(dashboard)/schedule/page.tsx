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
      <header className="flex flex-wrap items-center justify-between gap-3 px-2 sm:px-4 pt-1 pb-3 border-b border-border/40 shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-foreground">All Channels</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
            <ToggleGroupItem value="list" className="gap-1.5 px-2.5 h-8">
              <LayoutList className="size-4" />
              <span className="text-xs font-medium">List</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" className="gap-1.5 px-2.5 h-8">
              <CalendarIcon className="size-4" />
              <span className="text-xs font-medium">Calendar</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => setCreatePostModalOpen(true)} className="gap-1.5 font-semibold text-xs sm:text-sm h-8 px-3 shrink-0">
            <Plus className="size-4" />
            New Post
          </Button>
        </div>
      </header>

      <div className="flex-1 min-w-0 overflow-hidden pt-2">
        {activeView === "list" ? (
          <ListView setCreatePostModalOpen={setCreatePostModalOpen} />
        ) : (
          <CalendarView />
        )}
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
    <Suspense fallback={<div>Loading...</div>}>
      <NuqsAdapter>
        <SchedulePageContent />
      </NuqsAdapter>
    </Suspense>
  )
}

export default SchedulePage