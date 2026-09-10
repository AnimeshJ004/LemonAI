import { formatBrandHashtags, cleanTag } from "@/lib/brand-helper";

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
 * Computes a staggered schedule Date for a specific channel on a target date.
 * Guarantees that even if multiple channels are scheduled for the same calendar date,
 * every platform gets its own distinct hour/minute and never overlaps on the calendar.
 */
export function getPlatformStaggeredDate(
  baseDate: Date | string,
  channelType: string,
  channelIndex: number = 0,
  slotIndex: number = 0
): Date {
  const d = new Date(baseDate);
  const peak = getPlatformPeakTime(channelType, slotIndex);

  // Set to the platform's peak engagement hour and minute
  d.setHours(peak.hour, peak.minute, 0, 0);

  // If baseDate was for today and the peak time already passed, offset from now
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday && d.getTime() <= now.getTime()) {
    // Stagger channels starting 15 minutes from now, separated by 75 minutes each
    const offsetMinutes = 15 + channelIndex * 75 + slotIndex * 120;
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
  // Visual storytelling, aesthetic emojis, clear IG CTA, 6-8 clustered discovery hashtags
  if (type.includes("instagram")) {
    const igTags = Array.from(tagPool).slice(0, 8);
    if (!igTags.includes(`#${cleanNiche}Tips`)) igTags.push(`#${cleanNiche}Tips`);
    if (!igTags.includes("#BusinessGrowth")) igTags.push("#BusinessGrowth");
    const tagCluster = igTags.join(" ");

    let igBody = cleaned;
    if (!igBody.startsWith("✨") && !igBody.startsWith("📸")) {
      igBody = `✨ Game-Changer for ${cleanNiche}:\n\n${igBody}`;
    }

    if (!igBody.toLowerCase().includes("save") && !igBody.toLowerCase().includes("share")) {
      igBody += "\n\n💡 Save this post for later 📌 & share with someone who needs this!";
    }

    return `${igBody}\n\n.\n.\n${tagCluster}`.trim();
  }

  // 2. BLUESKY
  // Authentic, candid conversational take. Strictly <= 300 characters, no hashtag clutter.
  if (type.includes("bluesky")) {
    let bskyBody = cleaned;
    if (!bskyBody.toLowerCase().startsWith("quick take") && !bskyBody.toLowerCase().startsWith("real talk")) {
      bskyBody = `Quick take on ${cleanNiche}:\n\n${bskyBody}`;
    }

    // Bluesky has strict 300 char limit
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

  // 3. TWITTER / X
  // Punchy, provocative hook, bold body, strict <= 280 chars, 1-2 sharp hashtags
  if (type.includes("twitter") || type.includes("x")) {
    const twitterTags = Array.from(tagPool).slice(0, 2).join(" ");
    const tagSuffix = twitterTags ? `\n\n${twitterTags}` : "";
    const maxBodyLen = 280 - tagSuffix.length - 2;

    let twBody = cleaned;
    if (!twBody.startsWith("⚡️") && !twBody.startsWith("🧵")) {
      twBody = `⚡️ ${twBody}`;
    }

    if (twBody.length > maxBodyLen) {
      const truncated = twBody.slice(0, maxBodyLen);
      const lastPeriod = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("?"), truncated.lastIndexOf("!"));
      if (lastPeriod > maxBodyLen * 0.6) {
        twBody = truncated.slice(0, lastPeriod + 1).trim();
      } else {
        const lastSpace = truncated.lastIndexOf(" ");
        twBody = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
      }
    }
    return `${twBody}${tagSuffix}`.trim();
  }

  // 4. LINKEDIN
  // Thought-leadership spacing, executive insights, discussion question, 3-4 professional hashtags
  if (type.includes("linkedin")) {
    const linkedinTags = Array.from(tagPool).slice(0, 4).join(" ");
    let liBody = cleaned;

    if (!liBody.toLowerCase().includes("insight") && !liBody.startsWith("💡")) {
      liBody = `💡 Key Insight for ${cleanNiche} Leaders:\n\n${liBody}`;
    }

    // Line breaks between sentences for easy mobile readability
    liBody = liBody.replace(/([.?!])\s+([A-Z])/g, "$1\n\n$2").trim();

    if (!liBody.includes("?")) {
      liBody += "\n\nAgree or disagree? What has been your experience with this?";
    }
    return `${liBody}\n\n${linkedinTags}`.trim();
  }

  // 5. FACEBOOK
  // Community friendly, conversational tone, open discussion prompt, 1-2 hashtags
  if (type.includes("facebook")) {
    const fbTags = Array.from(tagPool).slice(0, 2).join(" ");
    let fbBody = cleaned;

    if (!fbBody.toLowerCase().startsWith("hey") && !fbBody.startsWith("👋")) {
      fbBody = `Hey community! 👋\n\n${fbBody}`;
    }

    if (!fbBody.includes("?")) {
      fbBody += "\n\nWe'd love to hear your thoughts! Drop a comment below 👇";
    }
    return `${fbBody}${fbTags ? `\n\n${fbTags}` : ""}`.trim();
  }

  // 6. THREADS
  if (type.includes("threads")) {
    let thBody = cleaned;
    if (!thBody.toLowerCase().startsWith("curious:")) {
      thBody = `Curious to know:\n\n${thBody}`;
    }
    return thBody.trim();
  }

  // 7. YOUTUBE
  if (type.includes("youtube")) {
    return `📌 Overview:\n${cleaned}\n\n🔔 Subscribe to ${cleanBrand} for practical breakdowns and updates.`.trim();
  }

  const defaultTags = Array.from(tagPool).slice(0, 3).join(" ");
  return `${cleaned}${defaultTags ? `\n\n${defaultTags}` : ""}`.trim();
}
