export function cleanTag(str?: string, fallback: string = ""): string {
  if (!str) return fallback;
  return str.replace(/[^a-zA-Z0-9]/g, "");
}

export function formatBrandHashtags(brandProfile?: any): string[] {
  const brandName = cleanTag(brandProfile?.business_name, "Brand");
  const niche = cleanTag(brandProfile?.niche, "Business");

  const tags = new Set<string>();
  if (brandName) tags.add(`#${brandName}`);
  if (niche) tags.add(`#${niche}`);
  if (niche && niche.length > 2) tags.add(`#${niche}Tips`);
  if (brandName && niche) tags.add(`#${brandName}${niche}`);
  tags.add(`#${niche || "Business"}Growth`);
  tags.add(`#Trending`);

  return Array.from(tags).slice(0, 5);
}

export interface PlatformTimeSlot {
  timeSlot: string;
  hour: number;
  minute: number;
  label?: string;
}

/**
 * Returns prioritized algorithmic peak engagement times per social media platform.
 * Staggers platforms so content publishes at the highest-converting hour for each audience:
 * - LinkedIn: Morning professional hours (09:15 AM)
 * - Twitter/X: Midday real-time browsing (12:45 PM)
 * - Facebook: Mid-afternoon community reading (03:30 PM)
 * - YouTube: Pre-evening video consumption (05:15 PM)
 * - Instagram: Evening visual browsing (06:45 PM)
 * - Bluesky: Late-evening conversation (08:15 PM)
 * - Threads: Night conversation feed (09:00 PM)
 */
export function getPlatformPeakTime(channelType: string, slotIndex: number = 0): PlatformTimeSlot {
  const type = (channelType || "").toLowerCase();

  if (type.includes("linkedin")) {
    const slots: PlatformTimeSlot[] = [
      { timeSlot: "09:15 AM", hour: 9, minute: 15, label: "Morning B2B Focus" },
      { timeSlot: "04:45 PM", hour: 16, minute: 45, label: "End of Workday Review" },
      { timeSlot: "12:15 PM", hour: 12, minute: 15, label: "Lunch Networking" },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("twitter") || type.includes("x")) {
    const slots: PlatformTimeSlot[] = [
      { timeSlot: "12:45 PM", hour: 12, minute: 45, label: "Midday News & Scroll" },
      { timeSlot: "06:15 PM", hour: 18, minute: 15, label: "Evening Digest" },
      { timeSlot: "09:45 AM", hour: 9, minute: 45, label: "Morning Trending Feed" },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("facebook")) {
    const slots: PlatformTimeSlot[] = [
      { timeSlot: "03:30 PM", hour: 15, minute: 30, label: "Afternoon Community Reading" },
      { timeSlot: "08:00 PM", hour: 20, minute: 0, label: "Evening Family & Groups" },
      { timeSlot: "01:15 PM", hour: 13, minute: 15, label: "Lunch Break" },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("youtube")) {
    const slots: PlatformTimeSlot[] = [
      { timeSlot: "05:15 PM", hour: 17, minute: 15, label: "Pre-Evening Prime Watch" },
      { timeSlot: "11:00 AM", hour: 11, minute: 0, label: "Midday Shorts Feed" },
      { timeSlot: "08:00 PM", hour: 20, minute: 0, label: "Night Long-form" },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("instagram")) {
    const slots: PlatformTimeSlot[] = [
      { timeSlot: "06:45 PM", hour: 18, minute: 45, label: "Prime Evening Reels & Stories" },
      { timeSlot: "11:30 AM", hour: 11, minute: 30, label: "Lunch Break Discovery" },
      { timeSlot: "08:45 PM", hour: 20, minute: 45, label: "Night Wind-Down" },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("bluesky")) {
    const slots: PlatformTimeSlot[] = [
      { timeSlot: "08:15 PM", hour: 20, minute: 15, label: "Late-Evening Conversation" },
      { timeSlot: "02:00 PM", hour: 14, minute: 0, label: "Afternoon Feed" },
      { timeSlot: "10:30 AM", hour: 10, minute: 30, label: "Morning Feed" },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("threads")) {
    const slots: PlatformTimeSlot[] = [
      { timeSlot: "09:00 PM", hour: 21, minute: 0, label: "Night Discussion Feed" },
      { timeSlot: "01:30 PM", hour: 13, minute: 30, label: "Midday Discourse" },
      { timeSlot: "07:30 PM", hour: 19, minute: 30, label: "Evening Discussion" },
    ];
    return slots[slotIndex % slots.length];
  }

  // Default fallback slots
  const fallbackSlots: PlatformTimeSlot[] = [
    { timeSlot: "10:15 AM", hour: 10, minute: 15, label: "Morning Peak" },
    { timeSlot: "02:45 PM", hour: 14, minute: 45, label: "Afternoon Window" },
    { timeSlot: "07:30 PM", hour: 19, minute: 30, label: "Evening Prime" },
  ];
  return fallbackSlots[slotIndex % fallbackSlots.length];
}

/**
 * Returns full prioritized list of trending peak engagement windows for a channel,
 * factoring in weekday vs weekend and audience industry niche.
 */
export function getTrendingPeakTimesForPlatform(
  channelType: string,
  options?: { dayOfWeek?: number; niche?: string }
): PlatformTimeSlot[] {
  const type = (channelType || "").toLowerCase();
  const niche = (options?.niche || "").toLowerCase();
  const dayOfWeek = options?.dayOfWeek ?? new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 1. Industry / Niche specialized peak windows
  if (niche.includes("fitness") || niche.includes("gym") || niche.includes("health")) {
    return [
      { timeSlot: "06:45 AM", hour: 6, minute: 45, label: "Morning Workout Inspiration" },
      { timeSlot: "05:30 PM", hour: 17, minute: 30, label: "Post-Work Fitness Motivation" },
      { timeSlot: "12:15 PM", hour: 12, minute: 15, label: "Midday Health Break" },
    ];
  }

  if (niche.includes("food") || niche.includes("restaurant") || niche.includes("cafe")) {
    return [
      { timeSlot: "11:30 AM", hour: 11, minute: 30, label: "Lunch Craving Decision" },
      { timeSlot: "05:45 PM", hour: 17, minute: 45, label: "Dinner Planning" },
      { timeSlot: "08:15 PM", hour: 20, minute: 15, label: "Evening Foodie Reels" },
    ];
  }

  if (niche.includes("software") || niche.includes("saas") || niche.includes("b2b") || niche.includes("tech")) {
    if (isWeekend) {
      return [
        { timeSlot: "11:00 AM", hour: 11, minute: 0, label: "Weekend Tech Reading" },
        { timeSlot: "03:00 PM", hour: 15, minute: 0, label: "Afternoon Deep Dive" },
      ];
    }
    return [
      { timeSlot: "09:15 AM", hour: 9, minute: 15, label: "Morning Professional Focus" },
      { timeSlot: "01:00 PM", hour: 13, minute: 0, label: "Lunch Tech Discovery" },
      { timeSlot: "04:45 PM", hour: 16, minute: 45, label: "Wrap-up & Industry News" },
    ];
  }

  // 2. Platform-specific peaks with weekend adjustments
  if (type.includes("instagram")) {
    if (isWeekend) {
      return [
        { timeSlot: "11:00 AM", hour: 11, minute: 0, label: "Weekend Brunch Scroll" },
        { timeSlot: "07:30 PM", hour: 19, minute: 30, label: "Sunday Prime Reels" },
      ];
    }
    return [
      { timeSlot: "06:45 PM", hour: 18, minute: 45, label: "Prime Evening Reels" },
      { timeSlot: "11:30 AM", hour: 11, minute: 30, label: "Lunch Discovery" },
      { timeSlot: "08:45 PM", hour: 20, minute: 45, label: "Night Wind-Down" },
    ];
  }

  if (type.includes("linkedin")) {
    if (isWeekend) {
      return [
        { timeSlot: "10:00 AM", hour: 10, minute: 0, label: "Weekend Career Reflection" },
        { timeSlot: "02:30 PM", hour: 14, minute: 30, label: "Afternoon Insights" },
      ];
    }
    return [
      { timeSlot: "09:15 AM", hour: 9, minute: 15, label: "Morning B2B Focus" },
      { timeSlot: "04:45 PM", hour: 16, minute: 45, label: "End of Workday Review" },
      { timeSlot: "12:15 PM", hour: 12, minute: 15, label: "Lunch Networking" },
    ];
  }

  if (type.includes("twitter") || type.includes("x")) {
    return [
      { timeSlot: "12:45 PM", hour: 12, minute: 45, label: "Lunch Break News" },
      { timeSlot: "06:15 PM", hour: 18, minute: 15, label: "Evening Digest" },
      { timeSlot: "09:45 AM", hour: 9, minute: 45, label: "Morning Viral Feed" },
    ];
  }

  if (type.includes("youtube")) {
    return [
      { timeSlot: "05:15 PM", hour: 17, minute: 15, label: "Pre-Evening Prime Watch" },
      { timeSlot: "11:00 AM", hour: 11, minute: 0, label: "Midday Shorts Feed" },
      { timeSlot: "08:00 PM", hour: 20, minute: 0, label: "Night Long-form" },
    ];
  }

  if (type.includes("facebook")) {
    return [
      { timeSlot: "03:30 PM", hour: 15, minute: 30, label: "Afternoon Community Reading" },
      { timeSlot: "08:00 PM", hour: 20, minute: 0, label: "Evening Family & Groups" },
      { timeSlot: "01:15 PM", hour: 13, minute: 15, label: "Lunch Break" },
    ];
  }

  if (type.includes("threads")) {
    return [
      { timeSlot: "09:00 PM", hour: 21, minute: 0, label: "Night Discussion Feed" },
      { timeSlot: "01:30 PM", hour: 13, minute: 30, label: "Midday Discourse" },
      { timeSlot: "07:30 PM", hour: 19, minute: 30, label: "Evening Discussion" },
    ];
  }

  if (type.includes("bluesky")) {
    return [
      { timeSlot: "08:15 PM", hour: 20, minute: 15, label: "Late-Evening Conversation" },
      { timeSlot: "02:00 PM", hour: 14, minute: 0, label: "Afternoon Feed" },
      { timeSlot: "10:30 AM", hour: 10, minute: 30, label: "Morning Feed" },
    ];
  }

  return [
    { timeSlot: "10:15 AM", hour: 10, minute: 15, label: "Morning Peak" },
    { timeSlot: "02:45 PM", hour: 14, minute: 45, label: "Afternoon Window" },
    { timeSlot: "07:30 PM", hour: 19, minute: 30, label: "Evening Prime" },
  ];
}

/**
 * Intelligently finds the optimal trending/peak time for a given channel and date.
 * If targetDate is today: finds the next upcoming peak window (e.g. 6:45 PM instead of past 9:15 AM or arbitrary 2:30 PM).
 * If all peak slots today have passed: returns prime peak time for tomorrow.
 */
export function getOptimalTrendingTime(
  channelType: string,
  targetDate?: Date | string | null,
  niche?: string
): PlatformTimeSlot {
  const base = targetDate ? new Date(targetDate) : new Date();
  const now = new Date();
  const isTargetToday =
    base.getFullYear() === now.getFullYear() &&
    base.getMonth() === now.getMonth() &&
    base.getDate() === now.getDate();

  const slots = getTrendingPeakTimesForPlatform(channelType, {
    dayOfWeek: base.getDay(),
    niche,
  });

  if (isTargetToday) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Look for a peak slot today that is at least 15 minutes in the future
    const upcoming = slots.find((s) => {
      if (s.hour > currentHour) return true;
      if (s.hour === currentHour && s.minute >= currentMinute + 15) return true;
      return false;
    });

    if (upcoming) {
      return upcoming;
    }

    // If today's primary daytime peaks passed but it is before 9 PM, use late evening window
    if (currentHour < 21) {
      return { timeSlot: "08:45 PM", hour: 20, minute: 45, label: "Evening Prime Window" };
    }

    // If late at night, return tomorrow's top peak slot
    const tomorrowDay = (now.getDay() + 1) % 7;
    const tomorrowSlots = getTrendingPeakTimesForPlatform(channelType, {
      dayOfWeek: tomorrowDay,
      niche,
    });
    return tomorrowSlots[0] || slots[0];
  }

  // For future dates, always return the top primary peak time for that channel
  return slots[0];
}

/**
 * Checks if a given time slot string falls within one of the platform's trending peak windows.
 */
export function isTrendingTimeSlot(
  timeSlot: string,
  channelType: string,
  niche?: string
): boolean {
  if (!timeSlot) return false;
  const parsed = parseCustomTimeString(timeSlot);
  if (!parsed) return false;

  const slots = getTrendingPeakTimesForPlatform(channelType, { niche });
  return slots.some(
    (s) => Math.abs(s.hour * 60 + s.minute - (parsed.hour * 60 + parsed.minute)) <= 45
  );
}

/**
 * Parses user-provided time string (e.g. "14:30" or "02:30 PM" or "2:30 pm") into 24-hr hour/minute
 */
export function parseCustomTimeString(timeStr?: string): { hour: number; minute: number; timeSlot: string } | null {
  if (!timeStr) return null;
  const str = timeStr.trim();

  // 1. Match 24-hour format: "14:30", "09:00", "14:30:00"
  const match24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      const timeSlot = `${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${ampm}`;
      return { hour, minute, timeSlot };
    }
  }

  // 2. Match 12-hour format: "2:30 PM", "02:30 PM", "10:00 am"
  const match12 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      const displayHour = hour % 12 || 12;
      const timeSlot = `${displayHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${ampm}`;
      return { hour, minute, timeSlot };
    }
  }

  return null;
}

/**
 * Computes a schedule Date for a specific channel on a target date.
 * Strictly respects user-defined custom time slots (e.g. 2:30 PM / 14:30) and user timezone.
 */
export function getPlatformStaggeredDate(
  baseDate: Date | string,
  channelType: string,
  channelIndex: number = 0,
  slotIndex: number = 0,
  customTimeStr?: string,
  clientTimezoneOffset?: number,
  clientLocalToday?: { year: number; month: number; date: number },
  dayOffset: number = 0
): Date {
  const customParsed = parseCustomTimeString(customTimeStr);
  let hour: number;
  let minute: number;

  if (customParsed) {
    // User explicitly configured this time slot (e.g. 14:30 -> 2:30 PM)
    hour = customParsed.hour;
    minute = customParsed.minute;
  } else {
    // Algorithmic platform peak time fallback
    const peak = getPlatformPeakTime(channelType, slotIndex);
    hour = peak.hour;
    minute = peak.minute;
  }

  let scheduledDate: Date;

  // If client timezone offset is supplied (in minutes, e.g. -330 for UTC+05:30),
  // convert client local (year, month, day, hour, min) to the exact UTC timestamp.
  if (typeof clientTimezoneOffset === "number" && !isNaN(clientTimezoneOffset)) {
    let year: number;
    let month: number;
    let date: number;

    if (clientLocalToday && typeof clientLocalToday.year === "number") {
      year = clientLocalToday.year;
      month = clientLocalToday.month;
      date = clientLocalToday.date + dayOffset;
    } else {
      const b = new Date(baseDate);
      year = b.getFullYear();
      month = b.getMonth();
      date = b.getDate();
    }

    // Date.UTC returns UTC ms for given components. Adding (offset in minutes * 60 * 1000) converts local time to UTC.
    const utcMs = Date.UTC(year, month, date, hour, minute, 0, 0) + (clientTimezoneOffset * 60 * 1000);
    scheduledDate = new Date(utcMs);
  } else {
    // Standard server local time fallback
    scheduledDate = new Date(baseDate);
    scheduledDate.setHours(hour, minute, 0, 0);
  }

  // Only if customTimeStr was NOT provided, apply platform staggering offset
  if (!customParsed && channelIndex > 0) {
    const channelStaggerMs = (channelIndex * 5) * 60 * 1000;
    scheduledDate = new Date(scheduledDate.getTime() + channelStaggerMs);
  }

  // If the computed scheduled date has already passed in real-time, adjust slightly into the future
  const nowMs = Date.now();
  if (scheduledDate.getTime() <= nowMs) {
    // For past times today, place 15 mins in future so it can still safely queue/publish
    const graceMinutes = 15 + (customParsed ? 0 : channelIndex * 5);
    return new Date(nowMs + graceMinutes * 60 * 1000);
  }

  return scheduledDate;
}

/**
 * Tailors post copy specifically to each social media platform's psychology,
 * algorithm, formatting conventions, character limits, distinct hook prefix, and hashtag rules.
 * Generates visibly distinct hooks and opening words so no two platforms ever share identical copy.
 */
export function adaptCaptionForPlatform(
  rawContent: string,
  channelType: string,
  brandProfile?: { business_name?: string; niche?: string; brand_tone?: string }
): string {
  if (!rawContent || !rawContent.trim()) return rawContent;

  const type = (channelType || "").toLowerCase();
  const cleanBrand = cleanTag(brandProfile?.business_name, "Brand");
  const cleanNiche = cleanTag(brandProfile?.niche, "Business");
  const baseTags = formatBrandHashtags(brandProfile);

  // Clean raw markdown headers and asterisks
  let cleaned = rawContent
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();

  // Extract existing hashtags and clean them out of body
  const existingTags = cleaned.match(/#[a-zA-Z0-9_]+/g) || [];
  cleaned = cleaned.replace(/#[a-zA-Z0-9_]+/g, "").trim();

  const tagPool = new Set<string>();
  // Prioritize smart analyzed/curated hashtags first, then supplement with base brand tags
  for (const t of existingTags) if (t && t.length > 1) tagPool.add(t);
  for (const t of baseTags) if (t) tagPool.add(t);

  // 1. INSTAGRAM
  // Visual storytelling, authentic creative hook, clear IG CTA, 6-8 clustered discovery hashtags
  if (type.includes("instagram")) {
    const igTags = Array.from(tagPool).slice(0, 8);
    if (!igTags.includes(`#${cleanNiche}Tips`)) igTags.push(`#${cleanNiche}Tips`);
    if (!igTags.includes("#BusinessGrowth")) igTags.push("#BusinessGrowth");
    const tagCluster = igTags.join(" ");

    let igBody = cleaned;
    if (!igBody.toLowerCase().includes("save") && !igBody.toLowerCase().includes("share") && !igBody.toLowerCase().includes("comment")) {
      igBody += "\n\n💡 Save this post for later 📌 & share with someone who needs this!";
    }

    return `${igBody}\n\n.\n.\n${tagCluster}`.trim();
  }

  // 2. THREADS
  // Casual, authentic hot-take or conversational insight, open discussion prompt
  if (type.includes("threads")) {
    const threadTags = Array.from(tagPool).slice(0, 2).join(" ");
    let thBody = cleaned;

    // Remove corporate boilerplate and add candid conversational hook if missing
    if (!thBody.includes("?")) {
      thBody += "\n\nWhat are your thoughts on this? Drop your perspective 👇";
    }
    return `${thBody}${threadTags ? `\n\n${threadTags}` : ""}`.trim();
  }

  // 3. FACEBOOK
  // Community friendly, conversational tone, open discussion prompt, 1-2 hashtags
  if (type.includes("facebook")) {
    const fbTags = Array.from(tagPool).slice(0, 2).join(" ");
    let fbBody = cleaned;

    if (!fbBody.includes("?")) {
      fbBody += "\n\nWe'd love to hear your thoughts! Drop a comment below 👇";
    }
    return `${fbBody}${fbTags ? `\n\n${fbTags}` : ""}`.trim();
  }

  // 4. LINKEDIN
  // Thought-leadership spacing, executive insights, discussion question, 3-4 professional hashtags
  if (type.includes("linkedin")) {
    const linkedinTags = Array.from(tagPool).slice(0, 4).join(" ");
    let liBody = cleaned;

    // Line breaks between sentences for easy mobile readability
    liBody = liBody.replace(/([.?!])\s+([A-Z])/g, "$1\n\n$2").trim();

    if (!liBody.includes("?")) {
      liBody += "\n\nAgree or disagree? What has been your experience with this?";
    }
    return `${liBody}\n\n${linkedinTags}`.trim();
  }

  // 5. TWITTER / X
  // Punchy, provocative hook, bold body, strict <= 280 chars, 1-2 sharp hashtags
  if (type.includes("twitter") || type.includes("x")) {
    const twitterTags = Array.from(tagPool).slice(0, 2).join(" ");
    const tagSuffix = twitterTags ? `\n\n${twitterTags}` : "";
    const maxBodyLen = 280 - tagSuffix.length - 2;

    let twBody = cleaned;

    if (twBody.length > maxBodyLen) {
      const truncated = twBody.slice(0, maxBodyLen);
      const lastPeriod = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("?"), truncated.lastIndexOf("!"));
      if (lastPeriod > maxLenBoundary(maxBodyLen)) {
        twBody = truncated.slice(0, lastPeriod + 1).trim();
      } else {
        const lastSpace = truncated.lastIndexOf(" ");
        twBody = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
      }
    }
    return `${twBody}${tagSuffix}`.trim();
  }

  // 6. BLUESKY
  // Authentic, candid conversational take. Strictly <= 300 characters, no hashtag clutter.
  if (type.includes("bluesky")) {
    let bskyBody = cleaned;
    const maxLen = 295;
    if (bskyBody.length > maxLen) {
      const truncated = bskyBody.slice(0, maxLen);
      const lastPeriod = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("?"), truncated.lastIndexOf("!"));
      if (lastPeriod > maxLen * 0.6) {
        bskyBody = truncated.slice(0, lastPeriod + 1).trim();
      } else {
        const lastSpace = truncated.lastIndexOf(" ");
        bskyBody = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
      }
    }
    return bskyBody.trim();
  }

  // 7. YOUTUBE
  if (type.includes("youtube")) {
    return `${cleaned}\n\n🔔 Subscribe to ${cleanBrand} for weekly insights and updates.`.trim();
  }

  const defaultTags = Array.from(tagPool).slice(0, 3).join(" ");
  return `${cleaned}${defaultTags ? `\n\n${defaultTags}` : ""}`.trim();
}

function maxLenBoundary(len: number): number {
  return len * 0.6;
}
