import { describe, it, expect, vi, beforeEach } from "vitest";

// Setup mocked Insforge DB client
let postCounter = 0;
const { mockAdmin } = vi.hoisted(() => {
  const admin = {
    database: {
      from: vi.fn((table: string) => {
        const createResult = () => {
          if (table === "brand_profiles") {
            return {
              data: {
                business_name: "Apex Velocity Agency",
                niche: "High-Ticket B2B Growth",
                target_audience: "B2B Founders & Agency Owners",
                main_offer: "Autonomous Client Acquisition Systems",
                booking_url: "https://cal.com/apex/growth",
                auto_call_min_score: 8,
              },
              error: null,
            };
          }
          if (table === "user_channels") {
            return {
              data: [
                {
                  id: "chan_ig_1",
                  handle: "@apexvelocity",
                  is_connected: true,
                  channel_types: { id: "ct_1", type: "INSTAGRAM", name: "Instagram" },
                },
              ],
              error: null,
            };
          }
          if (table === "scheduled_posts") {
            postCounter++;
            return {
              data: { id: `post_f${postCounter}`, status: "queue", scheduled_at: new Date().toISOString() },
              error: null,
            };
          }
          if (table === "meta_campaigns") {
            return {
              data: {
                id: "camp_f1",
                name: "[AI Flywheel] High-Ticket B2B Growth",
                ad_headline: "Transform Your Agency Growth",
                daily_budget: 1500,
                call_to_action: "LEARN_MORE",
              },
              error: null,
            };
          }
          if (table === "social_automation_rules") {
            return {
              data: { id: "rule_growth_1" },
              error: null,
            };
          }
          if (table === "crm_activities") {
            return {
              data: { id: "act_1" },
              error: null,
            };
          }
          if (table === "flywheel_executions") {
            return {
              data: { id: "exec_1" },
              error: null,
            };
          }
          return { data: null, error: null };
        };

        const c: any = {
          select: vi.fn(() => c),
          insert: vi.fn(() => c),
          update: vi.fn(() => c),
          eq: vi.fn(() => c),
          order: vi.fn(() => c),
          limit: vi.fn(() => c),
          not: vi.fn(() => c),
          single: vi.fn(() => Promise.resolve(createResult())),
          maybeSingle: vi.fn(() => Promise.resolve(createResult())),
          then: (resolve: any) => resolve(createResult()),
        };
        return c;
      }),
    },
  };

  return { mockAdmin: admin };
});

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => mockAdmin,
}));

vi.mock("@/lib/trend-researcher", () => ({
  researchMarketTrends: vi.fn(async () => ({
    topTrendingHooks: [
      {
        hook: "Why 90% of Agencies fail to scale past $50k MRR",
        hookType: "PATTERN_INTERRUPT",
        targetEmotion: "Curiosity",
        whyItWorks: "Contrarian truth",
      },
    ],
    audiencePainPoints: [
      {
        painPoint: "Client churn and manual delivery bottlenecks",
        agitation: "Stuck doing low-leverage execution",
        proposedSolutionAngle: "Autonomous AI growth systems",
      },
    ],
    recommendedContentAngles: [
      {
        angleTitle: "The Autonomous Content Flywheel Playbook",
        suggestedFormat: "REEL",
        shortHook: "Stop trading time for client retainers",
      },
    ],
    recommendedHashtags: ["#AgencyGrowth", "#ScalingSaaS", "#AIAgents"],
  })),
}));

vi.mock("@/lib/ai-router", () => ({
  routeAICall: vi.fn(async () => ({
    success: true,
    data: {
      posts: [
        {
          dayNumber: 1,
          format: "REEL",
          title: "Stop trading hours for agency revenue",
          caption: "If you want to scale past $50k MRR, you must decouple delivery from human hours. #AgencyGrowth #AIAgents",
          script: "Hook: Stop trading hours for dollars.\nProblem: Scaling agencies burn out.\nSolution: Autonomous AI Flywheel.",
          mediaPrompt: "Modern cinematic tech workspace with glowing analytical displays",
        },
        {
          dayNumber: 2,
          format: "CAROUSEL",
          title: "The 5-Step AI Client Acquisition Flywheel",
          caption: "Swipe through to see how multi-agent automation turns organic content into booked client discovery calls. #ScalingSaaS",
          carouselSlides: [
            { slideNumber: 1, type: "COVER", headline: "The 5-Step Client Flywheel" },
            { slideNumber: 2, type: "CONTENT", headline: "Scrape Competitor Gaps" },
            { slideNumber: 3, type: "CONTENT", headline: "Automate Content Creation" },
            { slideNumber: 4, type: "CONTENT", headline: "Convert via Autonomous DM" },
            { slideNumber: 5, type: "CTA", headline: "Book Your Discovery Call" },
          ],
        },
      ],
    },
  })),
}));

vi.mock("@/lib/ai-memory", () => ({
  recordMemorySignal: vi.fn(async () => {}),
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(async () => ({ ids: ["event_flywheel_123"] })),
  },
}));

vi.mock("@/lib/direct-publisher", () => ({
  publishPostDirectly: vi.fn(async () => ({
    success: true,
    publishedUrl: "https://instagram.com/p/C_flywheel_published",
  })),
}));

import { executeAutonomousFlywheel } from "@/lib/flywheel-orchestrator";
import { recordMemorySignal } from "@/lib/ai-memory";
import { inngest } from "@/inngest/client";

describe("Autonomous 10-Agent Flywheel Closed-Loop Engine (lib/flywheel-orchestrator.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postCounter = 0;
  });

  it("orchestrates all 10 agents and returns complete closed-loop telemetry", async () => {
    const result = await executeAutonomousFlywheel({
      userId: "user_growth_pro",
      businessName: "Apex Velocity Agency",
      niche: "High-Ticket B2B Growth",
      targetAudience: "B2B Founders",
      daysToSchedule: 2,
      postsPerDay: 1,
      generateImages: false,
      autoDraftMetaAd: true,
    });

    expect(result.success).toBe(true);
    expect(result.postsScheduledCount).toBeGreaterThanOrEqual(2);
    expect(result.contentPieces.length).toBe(2);

    // Verify all 10 agents in the closed-loop
    const s = result.agentsStatus;
    expect(s).toBeDefined();

    // Agent 1: Research
    expect(s?.researchAgent.status).toBe("completed");
    expect(s?.researchAgent.topHook).toContain("Why 90% of Agencies fail");

    // Agent 2: Strategy
    expect(s?.strategyAgent.status).toBe("completed");
    expect(s?.strategyAgent.daysScheduled).toBe(2);

    // Agent 3: Content Studio
    expect(s?.contentStudioAgent.status).toBe("completed");
    expect(s?.contentStudioAgent.assetsCreated).toBe(2);

    // Agent 4: Distribution
    expect(s?.distributionAgent.status).toBe("completed");
    expect(s?.distributionAgent.postsScheduled).toBe(2);

    // Agent 5: Advertising
    expect(s?.adsAgent.status).toBe("completed");
    expect(s?.adsAgent.campaignId).toBe("camp_f1");
    expect(s?.adsAgent.dailyBudget).toBe(1500);

    // Agent 6: Inbound Conversation & DM Sales Agent
    expect(s?.inboundDMSalesAgent.status).toBe("completed");
    expect(s?.inboundDMSalesAgent.triggerKeyword).toBe("GROWTH");
    expect(s?.inboundDMSalesAgent.sendDmEnabled).toBe(true);

    // Agent 7: Sales Qualification Agent
    expect(s?.salesQualificationAgent.status).toBe("completed");
    expect(s?.salesQualificationAgent.minScoreThreshold).toBe(8);
    expect(s?.salesQualificationAgent.bookingUrlConfigured).toBe(true);

    // Agent 8: CRM & Pipeline Agent
    expect(s?.crmPipelineAgent.status).toBe("completed");
    expect(s?.crmPipelineAgent.activityLogged).toBe(true);
    expect(s?.crmPipelineAgent.estimatedPipelineValue).toBe(10000); // 2 posts * 5000

    // Agent 9: Growth Analytics Agent
    expect(s?.growthAnalyticsAgent.status).toBe("completed");
    expect(s?.growthAnalyticsAgent.projectedReach).toBeGreaterThan(0);
    expect(s?.growthAnalyticsAgent.projectedImpressions).toBeGreaterThan(0);

    // Agent 10: Closed-Loop AI Memory Optimizer
    expect(s?.closedLoopOptimizerAgent.status).toBe("completed");
    expect(s?.closedLoopOptimizerAgent.memoryInsightReinforced).toBe(true);
    expect(s?.closedLoopOptimizerAgent.inngestEventDispatched).toBe(true);

    // Confirm side-effects
    expect(recordMemorySignal).toHaveBeenCalledWith(
      "user_growth_pro",
      expect.objectContaining({
        signalType: "positive",
        contextNiche: "High-Ticket B2B Growth",
      }),
      expect.anything()
    );

    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "flywheel/cycle.completed",
      })
    );
  });
});
