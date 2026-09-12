"use client"
import * as React from "react"
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar"
import { format, parse, startOfWeek, getDay, addHours, isBefore, startOfDay } from "date-fns"
import { enUS } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus, } from "lucide-react"
import { HugeiconsIcon } from "@hugeicons/react"

import "react-big-calendar/lib/css/react-big-calendar.css"
import "./post-calendar.css"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getChannelIcon } from "@/constants/channels"
import { PostType } from "@/types/post.type"

const locales = { "en-US": enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})


interface PostCalendarProps {
  posts: PostType[]
  isPending: boolean
  currentDate: Date
  view: "month" | "week"
  onViewChange: (view: string) => void
  onDateChange: (date: Date) => void
  onPostClick: (post: any, allPosts?: any[], activeChannelType?: string) => void
  onCreatePost: (date: Date) => void
  rightActions?: React.ReactNode
}

function getEventTitle(content?: string): string {
  if (!content) return "Scheduled Post";
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
  const first = lines[0] || "";
  const clean = first.replace(/^#+\s*/, "").replace(/^[*_~`]+|[*_~`]+$/g, "").trim();
  return clean || "Scheduled Post";
}

export function PostCalendar({
  posts,
  isPending,
  currentDate,
  view,
  onViewChange,
  onDateChange,
  onPostClick,
  onCreatePost,
  rightActions,
}: PostCalendarProps) {

  const events = React.useMemo(() => {
    if (isPending || !posts || posts.length === 0) return []

    // Group posts scheduled within the same 5-minute block with identical/similar content
    const groupMap = new Map<string, PostType[]>()

    posts.forEach((p) => {
      if (!p.scheduled_at) return
      const d = new Date(p.scheduled_at)
      if (isNaN(d.getTime())) return

      const timeBlock = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${Math.floor(d.getMinutes() / 5) * 5}`
      const titleKey = getEventTitle(p.content).slice(0, 25).toLowerCase()
      const groupKey = `${timeBlock}_${titleKey}`

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, [])
      }
      groupMap.get(groupKey)!.push(p)
    })

    return Array.from(groupMap.values()).map((groupedPosts) => {
      const primaryPost = groupedPosts[0]
      const startDate = new Date(primaryPost.scheduled_at)
      
      // 25-minute duration guarantees half-hour intervals (2:00 vs 2:30) never collide on boundaries
      const maxSameDay = new Date(startDate)
      maxSameDay.setHours(23, 59, 59, 999)
      const endDate = new Date(Math.min(startDate.getTime() + 25 * 60 * 1000, maxSameDay.getTime()))

      // Collect all unique channel types for this post card
      const channels = groupedPosts
        .map((p) => p.user_channels?.channel_types)
        .filter(Boolean) as any[]

      // Check status
      const hasFailed = groupedPosts.some((p) => p.status === "failed")
      const allPublished = groupedPosts.every((p) => p.status === "published")
      const combinedStatus = hasFailed ? "failed" : allPublished ? "published" : "queue"

      return {
        ...primaryPost,
        allPosts: groupedPosts,
        channels,
        isMultiChannel: groupedPosts.length > 1,
        title: getEventTitle(primaryPost.content),
        start: startDate,
        end: endDate,
        allDay: false,
        status: combinedStatus,
      }
    })
  }, [posts, isPending])

  const formats = React.useMemo(() => ({
    weekdayFormat: (date: Date, culture?: string, localizer?: any) =>
      localizer.format(date, 'EEEE', culture),

    dayFormat: (date: Date, culture?: string, localizer?: any) =>
      localizer.format(date, 'EEEE d', culture),
  }), []);

  const isWeekView = view === "week"

  const CustomToolbar = (toolbar: any) => {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center border rounded-md overflow-hidden bg-background">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r" onClick={() => toolbar.onNavigate('PREV')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => toolbar.onNavigate('NEXT')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-sm sm:text-base font-semibold text-foreground">
            {format(toolbar.date, "MMMM yyyy")}
          </span>

          <Button variant="outline" size="sm" className="font-medium h-8 text-xs px-2.5" onClick={() => toolbar.onNavigate('TODAY')}>
            Today
          </Button>

          <select
            className="text-xs sm:text-sm font-medium bg-muted/50 border rounded-md px-2 py-1 focus:ring-0 cursor-pointer outline-none text-foreground"
            value={view}
            onChange={(e) => onViewChange(e.target.value)}
          >
            <option value="month">Month</option>
            <option value="week">Week</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {rightActions}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("h-full w-full relative flex flex-col min-h-[500px] min-w-[650px] bg-background")}>
      <Calendar
        localizer={localizer}
        events={events}
        date={currentDate}
        formats={formats}
        step={30}
        timeslots={2}
        min={new Date(0, 0, 0, 0, 0, 0)}
        max={new Date(0, 0, 0, 23, 59, 59)}
        scrollToTime={new Date(0, 0, 0, 8, 0, 0)}
        allDayAccessor={() => false}
        onNavigate={onDateChange}
        view={view === "month" ? Views.MONTH : Views.WEEK}
        views={{ month: true, week: true }}
        drilldownView="week"
        onDrillDown={(date) => {
          onDateChange(date)
          onViewChange("week")
        }}
        onShowMore={(events, date) => {
          onDateChange(date)
          onViewChange("week")
        }}
        onView={(v) => onViewChange(v === Views.MONTH ? "month" : "week")}
        onSelectEvent={(event: any) => {
          if (view === "month") {
            const targetDate = event.scheduled_at ? new Date(event.scheduled_at) : (event.start ? new Date(event.start) : new Date())
            onDateChange(targetDate)
            onViewChange("week")
          } else {
            onPostClick(event.allPosts?.[0] || event, event.allPosts)
          }
        }}
        slotPropGetter={(date) => {
          const isPastSlot = isBefore(date, new Date())
          return isPastSlot
            ? {
              className: "rbc-time-slot-disabled",
              style: {
                backgroundColor: "hsl(var(--muted) / 0.25)",
              },
            }
            : {}
        }}
        dayPropGetter={(date: Date) => {
          const isPastDate = isBefore(date, startOfDay(new Date()))
          return {
            className: isPastDate ? "bg-[#331f000f]!" : "",
            style: isPastDate ? { backgroundColor: "hsl(var(--muted) / 0.35)" } : {}
          }
        }}
        components={{
          toolbar: CustomToolbar,
          event: ({ event }: any) => {
            const isMulti = event.isMultiChannel && event.channels?.length > 1;
            const primaryChannel = event.channels?.[0] || event.user_channels?.channel_types;
            const Icon = getChannelIcon(primaryChannel?.type || undefined);
            const color = primaryChannel?.color || "#3b82f6";
            const eventDate = event.scheduled_at ? new Date(event.scheduled_at) : (event.start ? new Date(event.start) : new Date());
            const isValidDate = !isNaN(eventDate.getTime());
            const status = event.status;
            const allPostsList: any[] = event.allPosts && event.allPosts.length > 0 ? event.allPosts : [event];

            return (
              <div
                className={cn(
                  "flex flex-col justify-between p-1.5 h-full w-full rounded-md overflow-hidden transition-all hover:brightness-98 cursor-pointer shadow-2xs border relative select-none",
                  status === "failed" ? "bg-red-500/10 border-red-500/30 border-l-[3.5px] border-l-red-500" :
                  status === "published" ? "bg-emerald-500/10 border-emerald-500/30 border-l-[3.5px] border-l-emerald-500" :
                  "bg-card/95 border-border/80 hover:border-primary/50"
                )}
                style={status === "queue" ? {
                  borderLeftWidth: "3.5px",
                  borderLeftColor: color,
                } : undefined}
                title={view === "month" ? `Click to open ${isValidDate ? format(eventDate, "MMMM d") : "date"} in week calendar` : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (view === "month") {
                    onDateChange(eventDate);
                    onViewChange("week");
                  } else {
                    onPostClick(allPostsList[0] || event, allPostsList);
                  }
                }}
              >
                {/* Top Header: Platform Icons + Time */}
                <div className="flex items-center justify-between gap-1 w-full min-w-0">
                  <div className="flex items-center gap-1 overflow-x-hidden shrink-0 py-0.5">
                    {allPostsList.map((p: any, idx: number) => {
                      const ch = p.user_channels?.channel_types || event.channels?.[idx] || primaryChannel;
                      const ChIcon = getChannelIcon(ch?.type);
                      const chColor = ch?.color || color;
                      const chHandle = p.user_channels?.handle;
                      const chStatus = p.status;

                      return ChIcon ? (
                        <button
                          key={p.id || idx}
                          type="button"
                          title={`Click to view ${ch?.name || ch?.type || "account"} (@${chHandle || "account"}) - ${chStatus || "scheduled"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (view === "month") {
                              onDateChange(eventDate);
                              onViewChange("week");
                            } else {
                              onPostClick(p, allPostsList, ch?.type);
                            }
                          }}
                          className={cn(
                            "size-4 sm:size-4.5 rounded flex items-center justify-center shrink-0 shadow-2xs transition-all hover:scale-115 active:scale-95 cursor-pointer",
                            chStatus === "published" && "ring-1 ring-emerald-500/80",
                            chStatus === "failed" && "ring-1 ring-red-500/80"
                          )}
                          style={{ background: chColor }}
                        >
                          <HugeiconsIcon icon={ChIcon} className="size-2.5 text-white" />
                        </button>
                      ) : null;
                    })}
                  </div>

                  <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap ml-auto shrink-0">
                    {isValidDate ? format(eventDate, "h:mm a") : ""}
                  </span>
                </div>

                {/* Title & Preview */}
                <div className="min-w-0 my-0.5 flex-1 flex flex-col justify-center overflow-hidden">
                  <span className="text-[11px] font-semibold text-foreground truncate block leading-snug">
                    {event?.title || "Scheduled Post"}
                  </span>
                </div>

                {/* Multi-channel badge footer */}
                {isMulti && (
                  <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-border/40 text-[9px] text-muted-foreground">
                    <span className="font-semibold text-[9px] text-muted-foreground truncate">
                      {allPostsList.length} accounts
                    </span>
                    <span className={cn(
                      "text-[8px] uppercase font-bold px-1 rounded",
                      status === "published" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                      status === "failed" ? "bg-red-500/20 text-red-600 dark:text-red-400" :
                      "bg-primary/10 text-primary"
                    )}>
                      {status}
                    </span>
                  </div>
                )}
              </div>
            )
          },

          month: {
            dateHeader: ({ label, date: cellDate }: any) => {
              const isCellToday = format(cellDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              const isPastDate = isBefore(cellDate, startOfDay(new Date()))
              const cellKey = format(cellDate, 'yyyy-MM-dd')
              const dayEventsCount = events.filter((e) => {
                const d = new Date(e.start)
                return format(d, 'yyyy-MM-dd') === cellKey
              }).length

              return (
                <>
                  <div className="group flex items-center justify-between w-full px-1 pt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDateChange(cellDate)
                          onViewChange("week")
                        }}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold transition-all hover:scale-110 cursor-pointer shadow-2xs shrink-0",
                          isCellToday ? "bg-green-500 text-white hover:bg-green-600" : isPastDate ? "text-muted-foreground hover:bg-muted" : "text-foreground hover:bg-muted"
                        )}
                        title={`Open ${format(cellDate, "EEEE, MMMM d")} in full calendar`}
                      >
                        {label}
                      </button>

                      {dayEventsCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDateChange(cellDate)
                            onViewChange("week")
                          }}
                          className="text-[10px] font-semibold text-primary/90 bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                          title={`View all ${dayEventsCount} scheduled post${dayEventsCount > 1 ? "s" : ""} on ${format(cellDate, "MMM d")}`}
                        >
                          {dayEventsCount} {dayEventsCount === 1 ? "post" : "posts"}
                        </button>
                      )}
                    </div>

                    {!isPastDate && !isPending && (
                      <Button
                        size="icon-sm"
                        variant="default"
                        className="p-px! size-6! hover:scale-105 transition-transform shrink-0"
                        title={`Schedule post for ${format(cellDate, "MMM d")}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onCreatePost(cellDate)
                        }}
                      >
                        <Plus className="size-3" />
                      </Button>
                    )}
                  </div>
                  {isPending && <Skeleton className="h-8 w-11/12 m-2 my-5" />}
                </>
              )
            }
          },
        }}
      />
    </div>
  )
}
