import { formatBrandHashtags, cleanTag } from "@/lib/brand-helper";

export interface PlatformTimeSlot {
  timeSlot: string;
  hour: number;
  minute: number;
}

/**
 * Returns algorithmic peak engagement times per social media platform.
 * Staggers platforms so content publishes at the highest-converting hour for each audience.
 */
export function getPlatformPeakTime(channelType: string, slotIndex: number = 0): PlatformTimeSlot {
  const type = (channelType || "").toLowerCase();

  if (type.includes("linkedin")) {
    // LinkedIn peak: Morning business hours & end-of-day
    const slots = [
      { timeSlot: "09:15 AM", hour: 9, minute: 15 },
      { timeSlot: "04:45 PM", hour: 16, minute: 45 },
      { timeSlot: "12:15 PM", hour: 12, minute: 15 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("twitter") || type.includes("x")) {
    // Twitter/X peak: Midday news & real-time lunch browsing
    const slots = [
      { timeSlot: "12:45 PM", hour: 12, minute: 45 },
      { timeSlot: "06:15 PM", hour: 18, minute: 15 },
      { timeSlot: "09:45 AM", hour: 9, minute: 45 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("facebook")) {
    // Facebook peak: Mid-afternoon community browsing
    const slots = [
      { timeSlot: "03:30 PM", hour: 15, minute: 30 },
      { timeSlot: "08:00 PM", hour: 20, minute: 0 },
      { timeSlot: "01:15 PM", hour: 13, minute: 15 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("instagram")) {
    // Instagram peak: Evening visual browsing & pre-lunch
    const slots = [
      { timeSlot: "07:15 PM", hour: 19, minute: 15 },
      { timeSlot: "11:30 AM", hour: 11, minute: 30 },
      { timeSlot: "08:45 PM", hour: 20, minute: 45 },
    ];
    return slots[slotIndex % slots.length];
  }

  if (type.includes("threads") || type.includes("bluesky")) {
    const slots = [
      { timeSlot: "08:30 PM", hour: 20, minute: 30 },
      { timeSlot: "01:30 PM", hour: 13, minute: 30 },
    ];
    return slots[slotIndex % slots.length];
  }

  // Fallback staggered peak slots
  const fallbackSlots = [
    { timeSlot: "10:00 AM", hour: 10, minute: 0 },
    { timeSlot: "02:30 PM", hour: 14, minute: 30 },
    { timeSlot: "06:30 PM", hour: 18, minute: 30 },
  ];
  return fallbackSlots[slotIndex % fallbackSlots.length];
}

/**
 * Tailors post copy specifically to each social media platform's psychology,
 * algorithm, formatting conventions, character limits, and hashtag rules.
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

  // Extract existing hashtags
  const existingTags = cleaned.match(/#[a-zA-Z0-9_]+/g) || [];
  cleaned = cleaned.replace(/#[a-zA-Z0-9_]+/g, "").trim();

  // Combine unique tags
  const tagPool = new Set<string>();
  for (const t of baseTags) if (t) tagPool.add(t);
  for (const t of existingTags) if (t && t.length > 1) tagPool.add(t);

  // 1. TWITTER / X (Strict <= 280 characters, crisp hook, 1-2 hashtags)
  if (type.includes("twitter") || type.includes("x")) {
    const twitterTags = Array.from(tagPool).slice(0, 2).join(" ");
    const tagSuffix = twitterTags ? `\n\n${twitterTags}` : "";
    const maxBodyLen = 280 - tagSuffix.length - 2;

    // Strip emojis for punchy crisp reading if too long
    let body = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "").trim();

    if (body.length > maxBodyLen) {
      // Truncate at sentence or word boundary
      const truncated = body.slice(0, maxBodyLen);
      const lastPeriod = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("?"), truncated.lastIndexOf("!"));
      if (lastPeriod > maxBodyLen * 0.6) {
        body = truncated.slice(0, lastPeriod + 1).trim();
      } else {
        const lastSpace = truncated.lastIndexOf(" ");
        body = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
      }
    }

    return `${body}${tagSuffix}`.trim();
  }

  // 2. LINKEDIN (Thought-leadership, professional line breaks, discussion question, 3-4 hashtags)
  if (type.includes("linkedin")) {
    const linkedinTags = Array.from(tagPool).slice(0, 4).join(" ");

    // Ensure generous line breaks between sentences for easy mobile reading
    let formatted = cleaned
      .replace(/([.?!])\s+([A-Z])/g, "$1\n\n$2")
      .trim();

    // Add a thoughtful closing question if not present
    if (!formatted.includes("?")) {
      formatted += "\n\nAgree? What has been your experience with this in your business?";
    }

    return `${formatted}\n\n${linkedinTags}`.trim();
  }

  // 3. INSTAGRAM (Visual storytelling, aesthetic emojis, call to action, 8-10 clustered hashtags)
  if (type.includes("instagram")) {
    const igTags = Array.from(tagPool).slice(0, 8);
    // Add niche discovery tags
    if (!igTags.includes(`#${cleanNiche}Tips`)) igTags.push(`#${cleanNiche}Tips`);
    if (!igTags.includes("#BusinessGrowth")) igTags.push("#BusinessGrowth");
    const tagCluster = igTags.join(" ");

    let formatted = cleaned;
    // Add call to action if not present
    if (!formatted.toLowerCase().includes("save") && !formatted.toLowerCase().includes("bio")) {
      formatted += "\n\nSave this post for later 📌 & share with your team!";
    }

    return `${formatted}\n\n.\n.\n${tagCluster}`.trim();
  }

  // 4. FACEBOOK (Warm community tone, relatable conversational hook, 1-2 hashtags)
  if (type.includes("facebook")) {
    const fbTags = Array.from(tagPool).slice(0, 2).join(" ");
    let formatted = cleaned;

    if (!formatted.includes("?")) {
      formatted += "\n\nWe'd love to hear your thoughts! Drop a comment below 👇";
    }

    return `${formatted}${fbTags ? `\n\n${fbTags}` : ""}`.trim();
  }

  // 5. DEFAULT / THREADS / BLUESKY
  const defaultTags = Array.from(tagPool).slice(0, 3).join(" ");
  return `${cleaned}${defaultTags ? `\n\n${defaultTags}` : ""}`.trim();
}
