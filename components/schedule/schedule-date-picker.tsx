"use client"

import * as React from "react"
import { CalendarDays, ChevronDown, Clock, Check, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getOptimalTrendingTime, isTrendingTimeSlot } from "@/lib/platform-adapt-helper"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { format, startOfDay, addMinutes, isSameDay, isBefore } from "date-fns"

interface ScheduleDatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  time: string
  setTime: (time: string) => void
  className?: string
  align?: "start" | "center" | "end"
  renderButton?: (isDatePassed: boolean, isTimeNotAvailable: boolean) => React.ReactNode
  channelType?: string
  niche?: string
}

const generateTimeOptions = () => {
  const options: string[] = []
  const baseDate = startOfDay(new Date())
  for (let i = 0; i < 24 * 4; i++) {
    options.push(format(addMinutes(baseDate, i * 15), "h:mm a"))
  }
  return options
}

const timeOptions = generateTimeOptions()

export function ScheduleDatePicker({
  date,
  setDate,
  time,
  setTime,
  className,
  align = "end",
  renderButton,
  channelType,
  niche,
}: ScheduleDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const today = React.useMemo(() => startOfDay(new Date()), [])

  const availableTimeOptions = React.useMemo(() => {
    if (!date || !isSameDay(date, new Date())) return timeOptions
    const now = new Date()
    return timeOptions.filter((slot) => {
      const [timeValue, meridiem] = slot.split(" ")
      const [rawHour, rawMinute] = timeValue.split(":").map(Number)
      const hour = meridiem === "PM" && rawHour !== 12 ? rawHour + 12 : meridiem === "AM" && rawHour === 12 ? 0 : rawHour
      const candidate = new Date(date)
      candidate.setHours(hour, rawMinute, 0, 0)
      return !isBefore(candidate, now)
    })
  }, [date])

  const optimalTrending = React.useMemo(() => {
    return getOptimalTrendingTime(channelType || "instagram", date, niche)
  }, [channelType, date, niche])

  React.useEffect(() => {
    if (!time && availableTimeOptions.length > 0) {
      // Intelligently default to the platform's trending peak time if available
      const matchingTrendingOption = availableTimeOptions.find((opt) => {
        const match = opt.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
        if (!match) return false;
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const meridiem = match[3].toUpperCase();
        if (meridiem === "PM" && h !== 12) h += 12;
        if (meridiem === "AM" && h === 12) h = 0;
        return h === optimalTrending.hour && Math.abs(m - optimalTrending.minute) <= 15;
      });

      if (matchingTrendingOption) {
        setTime(matchingTrendingOption);
      } else {
        setTime(availableTimeOptions[0]);
      }
      return;
    }
    if (time) {
      setTime(time);
    }
  }, [availableTimeOptions, setTime, time, optimalTrending])

  const isDatePassed = date ? isBefore(date, new Date()) && !isSameDay(date, new Date()) : false
  const isTimeNotAvailable = React.useMemo(() => {
    if (!time) return false;
    if (!date || !isSameDay(date, new Date())) return false;
    const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return false;
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3] ? match[3].toUpperCase() : (h >= 12 ? "PM" : "AM");
    if (meridiem === "PM" && h !== 12) h += 12;
    if (meridiem === "AM" && h === 12) h = 0;
    const candidate = new Date(date);
    candidate.setHours(h, m, 0, 0);
    return isBefore(candidate, new Date());
  }, [date, time]);

  const handleTimeChange = (newTime: string) => {
    setTime(newTime)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="lg" className={cn("px-4", className)} variant="outline">
            <span className="flex-1 flex items-center gap-2 text-sm">
              <CalendarDays className="size-4" />
              <span className="flex items-center gap-1.5 font-semibold">
                {date ? format(date, "MMMM d") : "Set Date & Time"}
                {date && time && <span className="text-muted-foreground">, {time}</span>}
              </span>
            </span>
            <ChevronDown className="size-4!" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align={align}>
          <div className="w-full p-4 space-y-5">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: today }}
              className="p-0 w-full"
              formatters={{
                formatWeekdayName: (date) => date.toLocaleDateString('en-US', { weekday: 'narrow' })
              }}
              classNames={{
                month_caption: "flex justify-start items-center h-9 ml-2",
                caption_label: "text-base font-semibold",
                nav: "absolute right-2 top-0 flex items-center gap-1",
                month: "space-y-4 w-full",
                day: cn(
                  "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-muted transition-colors"
                ),
              }}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-semibold text-foreground/80">Select Time</h4>
                {channelType && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Flame className="size-2.5 fill-amber-500 text-amber-500" />
                    {channelType.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Quick 1-click Trending Peak shortcut */}
              <button
                type="button"
                onClick={() => {
                  const targetMatch = availableTimeOptions.find((opt) => {
                    const match = opt.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
                    if (!match) return false;
                    let h = parseInt(match[1], 10);
                    const m = parseInt(match[2], 10);
                    const meridiem = match[3].toUpperCase();
                    if (meridiem === "PM" && h !== 12) h += 12;
                    if (meridiem === "AM" && h === 12) h = 0;
                    return h === optimalTrending.hour && Math.abs(m - optimalTrending.minute) <= 15;
                  });
                  if (targetMatch) {
                    setTime(targetMatch);
                  } else {
                    setTime(optimalTrending.timeSlot);
                  }
                }}
                className={cn(
                  "w-full text-left text-xs p-2 rounded-md flex items-center justify-between border transition-all cursor-pointer",
                  time && isTrendingTimeSlot(time, channelType || "instagram", niche)
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300 font-medium"
                    : "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                )}
              >
                <span className="flex items-center gap-1.5 font-medium truncate">
                  <Flame className="size-3.5 text-amber-500 fill-amber-500 shrink-0" />
                  <span className="truncate">Peak ({optimalTrending.label || "Trending"}):</span>
                </span>
                <span className="font-bold underline ml-1 shrink-0">{optimalTrending.timeSlot}</span>
              </button>

              <div className="flex items-center gap-2">
                <Select value={time} onValueChange={handleTimeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[220px]">
                    {availableTimeOptions.map((timeOption) => {
                      const isTrending = isTrendingTimeSlot(timeOption, channelType || "instagram", niche);
                      return (
                        <SelectItem key={timeOption} value={timeOption} className="cursor-pointer">
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="flex items-center gap-1.5">
                              {isTrending ? (
                                <Flame className="size-3 text-amber-500 fill-amber-500 shrink-0" />
                              ) : (
                                <Clock className="size-3 text-muted-foreground shrink-0" />
                              )}
                              <span className={cn(isTrending && "font-semibold text-foreground")}>{timeOption}</span>
                            </span>
                            {isTrending && (
                              <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded shrink-0">
                                Trending Peak
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end p-4 border-t bg-muted/5">
            <Button size="lg" className="" onClick={() => setOpen(false)}>
              <Check className="size-4" />
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {renderButton && renderButton(isDatePassed, isTimeNotAvailable)}
    </>
  )
}
