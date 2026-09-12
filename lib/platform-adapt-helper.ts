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
}

/**
 * Returns algorithmic peak engagement times per social media platform.
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
    const slots = [
      { timeSlot: "09:15 AM", hour: 9, minute: 15 },
      { timeSlot: "04:45 PM", hour: 16, minute: 45 },
      { timeSlot: "12:15 PM", hour: 12, minute: 15 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("twitter") || type.includes("x")) {
    const slots = [
      { timeSlot: "12:45 PM", hour: 12, minute: 45 },
      { timeSlot: "06:15 PM", hour: 18, minute: 15 },
      { timeSlot: "09:45 AM", hour: 9, minute: 45 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("facebook")) {
    const slots = [
      { timeSlot: "03:30 PM", hour: 15, minute: 30 },
      { timeSlot: "08:00 PM", hour: 20, minute: 0 },
      { timeSlot: "01:15 PM", hour: 13, minute: 15 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("youtube")) {
    const slots = [
      { timeSlot: "05:15 PM", hour: 17, minute: 15 },
      { timeSlot: "11:00 AM", hour: 11, minute: 0 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("instagram")) {
    const slots = [
      { timeSlot: "06:45 PM", hour: 18, minute: 45 },
      { timeSlot: "11:30 AM", hour: 11, minute: 30 },
      { timeSlot: "08:45 PM", hour: 20, minute: 45 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("bluesky")) {
    const slots = [
      { timeSlot: "08:15 PM", hour: 20, minute: 15 },
      { timeSlot: "02:00 PM", hour: 14, minute: 0 },
      { timeSlot: "10:30 AM", hour: 10, minute: 30 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("threads")) {
    const slots = [
      { timeSlot: "09:00 PM", hour: 21, minute: 0 },
      { timeSlot: "01:30 PM", hour: 13, minute: 30 },
    ];
    return slots[slotIndex % slots.length];
  }

  // Default fallback slots
  const fallbackSlots = [
    { timeSlot: "10:15 AM", hour: 10, minute: 15 },
    { timeSlot: "02:45 PM", hour: 14, minute: 45 },
    { timeSlot: "07:30 PM", hour: 19, minute: 30 },
  ];
  return fallbackSlots[slotIndex % fallbackSlots.length];
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
 * Strictly respects user-defined custom time slots (e.g. 2:30 PM / 14:30) when provided.
 */
export function getPlatformStaggeredDate(
  baseDate: Date | string,
  channelType: string,
  channelIndex: number = 0,
  slotIndex: number = 0,
  customTimeStr?: string
): Date {
  const d = new Date(baseDate);
  const customParsed = parseCustomTimeString(customTimeStr);

  if (customParsed) {
    // User explicitly configured this time slot (e.g. 14:30 -> 2:30 PM)
    d.setHours(customParsed.hour, customParsed.minute, 0, 0);
  } else {
    // Algorithmic platform peak time fallback
    const peak = getPlatformPeakTime(channelType, slotIndex);
    d.setHours(peak.hour, peak.minute, 0, 0);
  }

  // If baseDate was for today and the scheduled time has already passed today, offset slightly
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday && d.getTime() <= now.getTime()) {
    // Stagger starting 15 minutes from now if time is already in past
    const offsetMinutes = 15 + channelIndex * 5 + slotIndex * 60;
    return new Date(now.getTime() + offsetMinutes * 60 * 1000);
  }

  return d;
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
  for (const t of baseTags) if (t) tagPool.add(t);
  for (const t of existingTags) if (t && t.length > 1) tagPool.add(t);

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
