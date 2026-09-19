import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractJsonFromText } from "@/lib/ai-gateway";
import { getBrandBrainSummary, formatBrandHashtags, cleanTag } from "@/lib/brand-helper";
import { getPlatformPeakTime, parseCustomTimeString } from "@/lib/platform-adapt-helper";

describe("AI Engine & LLM Output Integration Tests", () => {
  describe("Structured JSON Output Parsing (extractJsonFromText)", () => {
    it("parses clean JSON objects correctly", () => {
      const raw = '{"caption": "Scaling to $100k MRR", "tags": ["saas", "growth"]}';
      const parsed = extractJsonFromText<{ caption: string; tags: string[] }>(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.caption).toBe("Scaling to $100k MRR");
      expect(parsed?.tags).toEqual(["saas", "growth"]);
    });

    it("parses clean JSON arrays correctly", () => {
      const raw = '["Idea 1: Cold Email Mastery", "Idea 2: LinkedIn Lead Gen", "Idea 3: SEO Playbook"]';
      const parsed = extractJsonFromText<string[]>(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.length).toBe(3);
      expect(parsed?.[0]).toContain("Cold Email");
    });

    it("strips ```json markdown formatting from LLM response", () => {
      const raw = `\`\`\`json
{
  "headline": "5 Ways AI Transforms Marketing",
  "score": 9.5,
  "action": "publish"
}
\`\`\``;
      const parsed = extractJsonFromText<{ headline: string; score: number; action: string }>(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.headline).toBe("5 Ways AI Transforms Marketing");
      expect(parsed?.score).toBe(9.5);
      expect(parsed?.action).toBe("publish");
    });

    it("strips untyped ``` markdown code fences", () => {
      const raw = `\`\`\`
{
  "status": "success",
  "count": 42
}
\`\`\``;
      const parsed = extractJsonFromText<{ status: string; count: number }>(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.status).toBe("success");
      expect(parsed?.count).toBe(42);
    });

    it("extracts embedded JSON when surrounded by conversational LLM filler", () => {
      const raw = `Here is the carousel slide plan you requested for your campaign:
{
  "slides": [
    {"slideNumber": 1, "title": "Hook Slide"},
    {"slideNumber": 2, "title": "Problem Statement"}
  ]
}
Let me know if you want any edits or revisions!`;
      const parsed = extractJsonFromText<{ slides: Array<{ slideNumber: number; title: string }> }>(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.slides.length).toBe(2);
      expect(parsed?.slides[0].title).toBe("Hook Slide");
    });

    it("returns null gracefully on non-JSON text or malformed JSON", () => {
      expect(extractJsonFromText("")).toBeNull();
      expect(extractJsonFromText("Just a regular text string without JSON")).toBeNull();
      expect(extractJsonFromText("{ broken json: true, missing quotes }")).toBeNull();
    });
  });

  describe("Brand Brain Context Formatting (lib/brand-helper.ts)", () => {
    it("generates complete Business Brain prompt context", () => {
      const mockProfile = {
        business_name: "Apex Growth Agency",
        niche: "B2B SaaS Growth",
        target_audience: "Series A-B Founders & CMOs",
        brand_tone: "Authoritative, data-driven, and actionable",
        main_offer: "Full-funnel pipeline generation and paid acquisition",
        pricing_details: "Retainers from $5,000/mo to $15,000/mo",
        products_services: "Paid Ads, Outbound Funnels, Social Content Engine",
        location: "Austin, TX & Remote Global",
        booking_url: "https://cal.com/apex-growth/intro",
      };

      const summary = getBrandBrainSummary(mockProfile);

      expect(summary).toContain("Apex Growth Agency");
      expect(summary).toContain("B2B SaaS Growth");
      expect(summary).toContain("Series A-B Founders & CMOs");
      expect(summary).toContain("Authoritative, data-driven");
      expect(summary).toContain("Retainers from $5,000/mo");
      expect(summary).toContain("https://cal.com/apex-growth/intro");
    });

    it("returns fallback summary when brand profile is missing or empty", () => {
      expect(getBrandBrainSummary(null)).toBe("Business Brain: General business growth and customer service.");
      expect(getBrandBrainSummary(undefined)).toBe("Business Brain: General business growth and customer service.");
    });

    it("formats clean brand hashtags without special characters", () => {
      const profile = {
        business_name: "Lemon AI & Co.!",
        niche: "AI Marketing",
      };

      const tags = formatBrandHashtags(profile);
      expect(tags.length).toBeLessThanOrEqual(5);
      expect(tags).toContain("#LemonAICo");
      expect(tags).toContain("#AIMarketing");
      expect(tags.every((t) => /^#[a-zA-Z0-9]+$/.test(t))).toBe(true);
    });

    it("cleans tags properly", () => {
      expect(cleanTag("Hello World! 123", "Fallback")).toBe("HelloWorld123");
      expect(cleanTag("", "Fallback")).toBe("Fallback");
      expect(cleanTag(undefined, "Default")).toBe("Default");
    });
  });

  describe("Platform Optimization & Peak Time Allocation (lib/platform-adapt-helper.ts)", () => {
    it("returns strategic peak engagement times for each platform", () => {
      const li = getPlatformPeakTime("LINKEDIN", 0);
      expect(li.hour).toBe(9);
      expect(li.minute).toBe(15);
      expect(li.timeSlot).toBe("09:15 AM");

      const tw = getPlatformPeakTime("TWITTER", 0);
      expect(tw.hour).toBe(12);
      expect(tw.minute).toBe(45);
      expect(tw.timeSlot).toBe("12:45 PM");

      const ig = getPlatformPeakTime("INSTAGRAM", 0);
      expect(ig.hour).toBe(18);
      expect(ig.minute).toBe(45);
      expect(ig.timeSlot).toBe("06:45 PM");

      const fb = getPlatformPeakTime("FACEBOOK", 0);
      expect(fb.hour).toBe(15);
      expect(fb.minute).toBe(30);
      expect(fb.timeSlot).toBe("03:30 PM");

      const bsky = getPlatformPeakTime("BLUESKY", 0);
      expect(bsky.hour).toBe(20);
      expect(bsky.minute).toBe(15);
      expect(bsky.timeSlot).toBe("08:15 PM");
    });

    it("rotates time slots with slotIndex to prevent post clumping", () => {
      const slot0 = getPlatformPeakTime("LINKEDIN", 0);
      const slot1 = getPlatformPeakTime("LINKEDIN", 1);
      expect(slot0.timeSlot).not.toBe(slot1.timeSlot);
    });

    it("accurately parses user-defined 24-hour time strings", () => {
      const res = parseCustomTimeString("14:30");
      expect(res).not.toBeNull();
      expect(res?.hour).toBe(14);
      expect(res?.minute).toBe(30);
      expect(res?.timeSlot).toBe("02:30 PM");
    });

    it("accurately parses user-defined 12-hour AM/PM time strings", () => {
      const res = parseCustomTimeString("09:45 AM");
      expect(res).not.toBeNull();
      expect(res?.hour).toBe(9);
      expect(res?.minute).toBe(45);
      expect(res?.timeSlot).toBe("09:45 AM");

      const pmRes = parseCustomTimeString("8:15 pm");
      expect(pmRes).not.toBeNull();
      expect(pmRes?.hour).toBe(20);
      expect(pmRes?.minute).toBe(15);
      expect(pmRes?.timeSlot).toBe("08:15 PM");
    });
  });
});
