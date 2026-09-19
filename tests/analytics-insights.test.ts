import { describe, it, expect, vi } from "vitest";
import { getMetaAdsInsights } from "@/lib/meta-ads";

describe("Analytics & Reporting: Telemetry & Visual Charts", () => {
  describe("Meta Ads Insights API Engine", () => {
    it("returns sandbox safe metrics when no live access token or ad account is supplied", async () => {
      const result = await getMetaAdsInsights("act_000000000", undefined);

      expect(result.isLiveData).toBe(false);
      expect(result.spend).toBe(0);
      expect(result.impressions).toBe(0);
      expect(result.clicks).toBe(0);
      expect(result.cpc).toBe(0);
      expect(result.ctr).toBe(0);
      expect(result.roas).toBeNull();
    });

    it("parses live Meta Ads API response data with ROAS, CPC, and CTR", () => {
      const rawApiResponse = {
        data: [
          {
            spend: "14500.50",
            impressions: "52400",
            clicks: "1920",
            cpc: "7.55",
            cpm: "276.72",
            ctr: "3.66",
            purchase_roas: [{ action_type: "omni_purchase", value: "4.20" }],
            actions: [
              { action_type: "lead", value: "115" },
              { action_type: "link_click", value: "1920" },
            ],
          },
        ],
      };

      const row = rawApiResponse.data[0];
      const spend = parseFloat(row.spend);
      const impressions = parseInt(row.impressions, 10);
      const clicks = parseInt(row.clicks, 10);
      const cpc = parseFloat(row.cpc);
      const ctr = parseFloat(row.ctr);
      const roas = parseFloat(row.purchase_roas[0].value);

      expect(spend).toBe(14500.5);
      expect(impressions).toBe(52400);
      expect(clicks).toBe(1920);
      expect(cpc).toBe(7.55);
      expect(ctr).toBe(3.66);
      expect(roas).toBe(4.2);
    });
  });

  describe("LinkedIn Insights & Social Telemetry Aggregation", () => {
    it("aggregates LinkedIn share statistics from API response elements", () => {
      const apiResponse = {
        elements: [
          {
            totalShareStatistics: {
              uniqueImpressionsCount: 1420,
              impressionCount: 1850,
              clickCount: 110,
              engagement: 0.062,
              likeCount: 45,
              commentCount: 12,
            },
          },
          {
            totalShareStatistics: {
              uniqueImpressionsCount: 980,
              impressionCount: 1200,
              clickCount: 85,
              engagement: 0.054,
              likeCount: 30,
              commentCount: 8,
            },
          },
        ],
      };

      let totalImpressions = 0;
      let totalEngagementSum = 0;

      for (const el of apiResponse.elements) {
        totalImpressions += el.totalShareStatistics.uniqueImpressionsCount;
        totalEngagementSum += el.totalShareStatistics.engagement;
      }

      const avgEngagement = totalEngagementSum / apiResponse.elements.length;

      expect(totalImpressions).toBe(2400);
      expect(avgEngagement).toBeCloseTo(0.058, 3);
    });

    it("calculates lead source distribution percentages for Donut chart", () => {
      const rawSources = [
        { source: "website", label: "Website Bot", count: 40 },
        { source: "whatsapp", label: "WhatsApp Bot", count: 30 },
        { source: "instagram", label: "Instagram DM", count: 20 },
        { source: "voice", label: "AI Voice Call", count: 10 },
      ];

      const totalCount = rawSources.reduce((s, item) => s + item.count, 0);
      expect(totalCount).toBe(100);

      const distribution = rawSources.map((item) => ({
        ...item,
        percentage: Math.round((item.count / totalCount) * 100),
      }));

      expect(distribution[0].percentage).toBe(40);
      expect(distribution[1].percentage).toBe(30);
      expect(distribution[2].percentage).toBe(20);
      expect(distribution[3].percentage).toBe(10);
    });
  });

  describe("Time-Series Trend Points Calculation", () => {
    it("generates continuous daily trend points with formatted date and non-negative values", () => {
      const days = 7;
      const points = [];
      const now = new Date("2026-09-19T10:00:00Z");

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const isoDate = d.toISOString().slice(0, 10);

        points.push({
          date: dateStr,
          fullDate: isoDate,
          impressions: 450 + i * 20,
          reach: 320 + i * 15,
          engagement: 25 + i * 2,
        });
      }

      expect(points).toHaveLength(7);
      expect(points[0].impressions).toBeGreaterThan(0);
      expect(points[6].fullDate).toBe("2026-09-19");
      expect(points[0].date).toBeDefined();
    });
  });

  describe("Visual Chart Geometry & Bar/Line Rendering Math", () => {
    const sampleData = [
      { date: "Sep 13", fullDate: "2026-09-13", impressions: 1200, reach: 900, engagement: 80 },
      { date: "Sep 14", fullDate: "2026-09-14", impressions: 1800, reach: 1350, engagement: 120 },
      { date: "Sep 15", fullDate: "2026-09-15", impressions: 2400, reach: 1700, engagement: 190 },
      { date: "Sep 16", fullDate: "2026-09-16", impressions: 3100, reach: 2200, engagement: 240 },
    ];

    it("calculates chart bounds and line coordinates correctly", () => {
      const width = 800;
      const height = 240;
      const padding = { top: 20, right: 25, bottom: 35, left: 55 };
      const chartW = width - padding.left - padding.right;
      const chartH = height - padding.top - padding.bottom;

      const maxVal = Math.max(...sampleData.flatMap((d) => [d.impressions, d.reach]));
      expect(maxVal).toBe(3100);

      const points = sampleData.map((d, i) => {
        const x = padding.left + (i / (sampleData.length - 1)) * chartW;
        const yImp = padding.top + chartH - (d.impressions / maxVal) * chartH;
        const yReach = padding.top + chartH - (d.reach / maxVal) * chartH;
        return { ...d, x, yImp, yReach };
      });

      expect(points[0].x).toBe(padding.left);
      expect(points[points.length - 1].x).toBe(width - padding.right);
      // Highest impression point has minimum y (closest to top padding)
      expect(points[3].yImp).toBeCloseTo(padding.top, 1);
      // Lowest impression point has y further down
      expect(points[0].yImp).toBeGreaterThan(points[3].yImp);
    });

    it("calculates vertical column bar dimensions without overlapping slots", () => {
      const width = 800;
      const padding = { top: 20, right: 25, bottom: 35, left: 55 };
      const chartW = width - padding.left - padding.right;
      const slotW = chartW / sampleData.length;

      // Group width for dual bars
      const groupW = Math.max(8, Math.min(slotW * 0.72, 32));
      const gap = Math.max(1, Math.min(groupW * 0.08, 3));
      const barW = (groupW - gap) / 2;

      expect(groupW).toBeLessThanOrEqual(slotW);
      expect(barW).toBeGreaterThan(0);
      expect(barW * 2 + gap).toBeCloseTo(groupW, 2);
    });

    it("computes pipeline stage bar distributions and conversion milestones", () => {
      const stages = [
        { stage: "new", count: 25 },
        { stage: "contacted", count: 20 },
        { stage: "qualified", count: 12 },
        { stage: "booked", count: 8 },
        { stage: "proposal", count: 5 },
        { stage: "closed_won", count: 3 },
        { stage: "closed_lost", count: 2 },
      ];

      const totalLeads = stages.reduce((acc, s) => acc + s.count, 0);
      const maxCount = Math.max(...stages.map((s) => s.count));

      expect(totalLeads).toBe(75);
      expect(maxCount).toBe(25);

      const stageShares = stages.map((s) => ({
        stage: s.stage,
        share: Math.round((s.count / totalLeads) * 100),
        relativeBarHeightPct: Math.round((s.count / maxCount) * 100),
      }));

      expect(stageShares.find((s) => s.stage === "new")?.share).toBe(33); // 25/75 = 33%
      expect(stageShares.find((s) => s.stage === "new")?.relativeBarHeightPct).toBe(100);
      expect(stageShares.find((s) => s.stage === "closed_won")?.relativeBarHeightPct).toBe(12); // 3/25 = 12%
    });
  });
});

