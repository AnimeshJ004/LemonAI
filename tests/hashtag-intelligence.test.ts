import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateHeuristicHashtags,
  getPlatformHashtagRules,
  analyzeViralHashtagsForProfile,
} from "@/lib/hashtag-analyzer";
import { adaptCaptionForPlatform } from "@/lib/platform-adapt-helper";
import { formatBrandHashtags } from "@/lib/brand-helper";

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user_test_hashtag" }),
}));

// Mock brand-helper for DB fetching
vi.mock("@/lib/brand-helper", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getBrandProfileForUser: vi.fn().mockResolvedValue({
      business_name: "Apex Growth Labs",
      niche: "SaaS Marketing",
      target_audience: "B2B Founders",
      location: "San Francisco",
    }),
  };
});

describe("AI Trending & Viral Hashtag Intelligence (lib/hashtag-analyzer.ts)", () => {
  describe("Heuristic & Profile-Grounded Hashtag Engine", () => {
    it("generates categorized hashtags tailored to a SaaS brand profile", () => {
      const profile = {
        business_name: "LemonAI",
        niche: "AI Marketing",
        target_audience: "Digital Agencies",
        location: "Bengaluru",
      };

      const result = generateHeuristicHashtags({
        brandProfile: profile,
        targetChannel: "INSTAGRAM",
      });

      expect(result.viralityScore).toBeGreaterThanOrEqual(80);
      expect(result.categories.branded).toContain("#LemonAI");
      expect(result.categories.niche).toContain("#AIMarketing");
      expect(result.categories.niche).toContain("#AIMarketingTips");
      expect(result.categories.viral.length).toBeGreaterThan(0);
      expect(result.categories.community.length).toBeGreaterThan(0);

      // Verify all hashtags start with # and are valid alphanumeric
      for (const cat of Object.values(result.categories)) {
        for (const tag of cat) {
          expect(tag).toMatch(/^#[a-zA-Z0-9_]+$/);
        }
      }
    });

    it("generates local clinic hashtags grounded in healthcare and geography", () => {
      const profile = {
        business_name: "SmileCare Dental",
        niche: "Dental Care",
        target_audience: "Families",
        location: "Mumbai",
      };

      const result = generateHeuristicHashtags({
        brandProfile: profile,
        targetChannel: "INSTAGRAM",
      });

      expect(result.categories.branded).toContain("#SmileCareDental");
      expect(result.categories.niche).toContain("#DentalCare");
      expect(result.recommendedBundle.length).toBeLessThanOrEqual(8);
    });

    it("handles undefined/empty brand profiles gracefully with sensible fallbacks", () => {
      const result = generateHeuristicHashtags({
        brandProfile: null,
      });

      expect(result.viralityScore).toBeGreaterThanOrEqual(80);
      expect(result.categories.viral.length).toBeGreaterThan(0);
      expect(result.recommendedBundle.length).toBeGreaterThan(0);
      expect(result.platformRules.platform).toBe("Instagram");
    });
  });

  describe("Platform-Specific Hashtag Distribution Rules", () => {
    it("enforces strict 1-2 hashtag limit for Twitter / X", () => {
      const rules = getPlatformHashtagRules("TWITTER");
      expect(rules.maxCount).toBe(2);
      expect(rules.optimalCount).toBe("1-2");
      expect(rules.platform).toBe("X / Twitter");

      const result = generateHeuristicHashtags({
        brandProfile: { business_name: "TechPulse", niche: "AI" },
        targetChannel: "TWITTER",
      });
      expect(result.recommendedBundle.length).toBeLessThanOrEqual(2);
    });

    it("enforces 3-5 hashtag limit for LinkedIn", () => {
      const rules = getPlatformHashtagRules("LINKEDIN");
      expect(rules.maxCount).toBe(5);
      expect(rules.optimalCount).toBe("3-5");
      expect(rules.platform).toBe("LinkedIn");

      const result = generateHeuristicHashtags({
        brandProfile: { business_name: "TechPulse", niche: "AI" },
        targetChannel: "LINKEDIN",
      });
      expect(result.recommendedBundle.length).toBeLessThanOrEqual(5);
    });

    it("allows rich 5-8 hashtag cluster for Instagram", () => {
      const rules = getPlatformHashtagRules("INSTAGRAM");
      expect(rules.maxCount).toBe(8);
      expect(rules.optimalCount).toBe("5-8");

      const result = generateHeuristicHashtags({
        brandProfile: { business_name: "TechPulse", niche: "AI" },
        targetChannel: "INSTAGRAM",
      });
      expect(result.recommendedBundle.length).toBeLessThanOrEqual(8);
    });
  });

  describe("analyzeViralHashtagsForProfile Execution", () => {
    it("returns complete intelligence structure with reasoning and trendingContext", async () => {
      const result = await analyzeViralHashtagsForProfile({
        brandProfile: {
          business_name: "FitLab Pro",
          niche: "Fitness Coaching",
          target_audience: "Busy Executives",
        },
        topicOrContent: "5 high-protein meals for busy mornings",
        targetChannel: "INSTAGRAM",
      });

      expect(result.viralityScore).toBeGreaterThanOrEqual(70);
      expect(result.recommendedBundle.length).toBeGreaterThan(0);
      expect(result.reasoning).toBeTruthy();
      expect(result.categories.viral.length).toBeGreaterThan(0);
      expect(result.categories.niche.length).toBeGreaterThan(0);
    });
  });

  describe("Integration with adaptCaptionForPlatform", () => {
    it("prioritizes smart viral hashtags in Instagram cluster", () => {
      const caption = "Discover how top agencies scale organically with smart automation. #ViralGrowth #AIAgency #AgencyGrowth";
      const adapted = adaptCaptionForPlatform(caption, "INSTAGRAM", {
        business_name: "LemonAI",
        niche: "SaaS",
      });

      expect(adapted).toContain("#ViralGrowth");
      expect(adapted).toContain("#AIAgency");
      expect(adapted).toContain("#AgencyGrowth");
      expect(adapted).toContain(".\n.\n");
    });

    it("respects Twitter character constraints while retaining high-impact tags", () => {
      const caption = "Excited to launch our new product today! Check out the live demo. #Launch #Startup";
      const adapted = adaptCaptionForPlatform(caption, "TWITTER", {
        business_name: "LemonAI",
        niche: "SaaS",
      });

      expect(adapted.length).toBeLessThanOrEqual(280);
      expect(adapted).toContain("#Launch");
    });
  });

  describe("API Route: POST /api/ai/trending-hashtags", () => {
    it("responds with full hashtag intelligence for authenticated user", async () => {
      const { POST } = await import("@/app/api/ai/trending-hashtags/route");

      const req = new Request("http://localhost/api/ai/trending-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "INSTAGRAM",
          topic: "Scaling our B2B SaaS pipeline in 2026",
        }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.profile.business_name).toBe("Apex Growth Labs");
      expect(json.profile.niche).toBe("SaaS Marketing");
      expect(json.viralityScore).toBeGreaterThan(0);
      expect(json.recommendedBundle.length).toBeGreaterThan(0);
      expect(json.categories.viral.length).toBeGreaterThan(0);
      expect(json.categories.niche.length).toBeGreaterThan(0);
      expect(json.platformRules.platform).toBe("Instagram");
    });

    it("returns 401 when unauthenticated", async () => {
      const { auth } = await import("@clerk/nextjs/server");
      (auth as any).mockResolvedValueOnce({ userId: null });

      const { POST } = await import("@/app/api/ai/trending-hashtags/route");

      const req = new Request("http://localhost/api/ai/trending-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "INSTAGRAM" }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(401);
    });
  });
});
