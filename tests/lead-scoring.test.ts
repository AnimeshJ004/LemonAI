import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI router so evaluateBANTLeadScore falls back to its deterministic
// heuristic path (no network / LLM calls in tests).
vi.mock("@/lib/ai-router", () => ({
  routeAICall: vi.fn(async () => {
    throw new Error("AI disabled in tests");
  }),
}));

// crm-service is imported transitively; stub updateLead so no DB is touched.
vi.mock("@/lib/crm-service", () => ({
  updateLead: vi.fn(async () => null),
}));

import { evaluateBANTLeadScore } from "@/lib/lead-scoring";

describe("lead-scoring heuristic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns baseline score for insufficient transcript", async () => {
    const res = await evaluateBANTLeadScore({ transcript: "hi" });
    expect(res.score).toBe(5);
    expect(res.isQualified).toBe(false);
  });

  it("boosts score for high-intent decision-maker signals", async () => {
    const res = await evaluateBANTLeadScore({
      transcript:
        "I am the founder and CEO. We need this ASAP, urgent. What is the price and cost? Contact me at ceo@acme.com 555 123 4567",
    });
    // base 5 + price/cost (1) + founder/ceo (2) + urgent/asap (1) + email&digits (1) = 10
    expect(res.score).toBeGreaterThanOrEqual(7);
    expect(res.isQualified).toBe(true);
    expect(res.score).toBeLessThanOrEqual(10);
  });

  it("keeps a neutral transcript around baseline and not qualified", async () => {
    const res = await evaluateBANTLeadScore({
      transcript: "Just browsing your website, looks interesting. Nothing specific right now.",
    });
    expect(res.score).toBeLessThan(7);
    expect(res.isQualified).toBe(false);
  });

  it("never exceeds the 1-10 bounds", async () => {
    const res = await evaluateBANTLeadScore({
      transcript:
        "founder ceo owner director urgent asap this month immediately price cost demo quote buy@x.com 555 987 6543",
    });
    expect(res.score).toBeLessThanOrEqual(10);
    expect(res.score).toBeGreaterThanOrEqual(1);
  });
});
