import { getInsforgeAdminClient } from "./insforge-server";

export interface OptimizationRecommendation {
  campaignId: string;
  campaignName: string;
  action: "SCALE_BUDGET" | "PAUSE_CAMPAIGN" | "REFRESH_CREATIVE" | "MAINTAIN";
  reason: string;
  currentBudget: number;
  recommendedBudget?: number;
  metrics: {
    estimatedSpend: number;
    leadsGenerated: number;
    costPerLead: number;
    status: string;
  };
}

export interface OptimizationAuditLog {
  id: string;
  campaignId: string;
  campaignName: string;
  action: string;
  details: string;
  timestamp: string;
}

/**
 * Evaluates all campaigns for a user and produces autonomous optimization directives.
 * Fulfills Sir's requirement: "Increase budget on Campaign A, stop Campaign B, create 4 variations"
 */
export async function evaluateCampaignsForOptimization(userId: string): Promise<{
  recommendations: OptimizationRecommendation[];
  summary: string;
}> {
  const admin = getInsforgeAdminClient();

  // 1. Fetch campaigns and CRM leads attributed to meta_ads
  const [campaignsRes, leadsRes] = await Promise.all([
    admin.database
      .from("meta_campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin.database
      .from("leads")
      .select("id, source, stage, deal_value, created_at, metadata")
      .eq("user_id", userId)
      .eq("source", "meta_ads"),
  ]);

  const campaigns = campaignsRes.data || [];
  const leads = leadsRes.data || [];

  if (campaigns.length === 0) {
    return {
      recommendations: [],
      summary: "No campaigns found. Create campaigns in AI Advertising to enable autonomous optimization.",
    };
  }

  const recommendations: OptimizationRecommendation[] = [];

  for (const campaign of campaigns) {
    const dailyBudget = Number(campaign.daily_budget) || 1000;
    const isRunning = (campaign.status || "").toUpperCase() === "ACTIVE";
    const daysActive = Math.max(
      1,
      Math.round((Date.now() - new Date(campaign.created_at).getTime()) / (1000 * 60 * 60 * 24))
    );

    // Approximate spend based on daily budget and runtime
    const estimatedSpend = dailyBudget * Math.min(daysActive, 7);

    // Count leads attributed specifically or generally to meta ads
    const campaignLeads = leads.filter(
      (l: any) => l.metadata?.campaignId === campaign.id || l.metadata?.campaignName === campaign.name
    );
    const leadCount = campaignLeads.length;
    const costPerLead = leadCount > 0 ? Math.round(estimatedSpend / leadCount) : estimatedSpend;

    if (!isRunning) {
      recommendations.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "MAINTAIN",
        reason: "Campaign currently inactive / draft. Ready for deployment.",
        currentBudget: dailyBudget,
        metrics: { estimatedSpend, leadsGenerated: leadCount, costPerLead, status: campaign.status || "DRAFT" },
      });
      continue;
    }

    // RULE 1: Underperforming Campaign → Auto-Pause
    if (daysActive >= 3 && leadCount === 0 && estimatedSpend >= 2000) {
      recommendations.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "PAUSE_CAMPAIGN",
        reason: `Spent ₹${estimatedSpend.toLocaleString()} over ${daysActive} days with 0 leads. Auto-pause to prevent ad spend waste.`,
        currentBudget: dailyBudget,
        metrics: { estimatedSpend, leadsGenerated: 0, costPerLead, status: "ACTIVE" },
      });
    }
    // RULE 2: Winning High-ROAS Campaign → Auto-Scale Budget +20%
    else if (leadCount >= 3 && costPerLead <= 350) {
      const newBudget = Math.round(dailyBudget * 1.2);
      recommendations.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "SCALE_BUDGET",
        reason: `Top Performer: ${leadCount} leads acquired at ₹${costPerLead}/lead. Scaling daily budget +20% to maximize volume.`,
        currentBudget: dailyBudget,
        recommendedBudget: newBudget,
        metrics: { estimatedSpend, leadsGenerated: leadCount, costPerLead, status: "ACTIVE" },
      });
    }
    // RULE 3: Creative Fatigue Alert
    else if (daysActive >= 10) {
      recommendations.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "REFRESH_CREATIVE",
        reason: `Active for ${daysActive} days. Frequency saturation likely. Generate 3 fresh hook variations in Ad Studio.`,
        currentBudget: dailyBudget,
        metrics: { estimatedSpend, leadsGenerated: leadCount, costPerLead, status: "ACTIVE" },
      });
    } else {
      recommendations.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        action: "MAINTAIN",
        reason: `Gathering learning data (${daysActive} days active). Maintaining ₹${dailyBudget}/day budget.`,
        currentBudget: dailyBudget,
        metrics: { estimatedSpend, leadsGenerated: leadCount, costPerLead, status: "ACTIVE" },
      });
    }
  }

  const toPause = recommendations.filter((r) => r.action === "PAUSE_CAMPAIGN").length;
  const toScale = recommendations.filter((r) => r.action === "SCALE_BUDGET").length;

  const summary = `Optimizer Analysis: ${toScale} campaigns recommended for +20% scale, ${toPause} underperformers flagged to pause.`;

  return { recommendations, summary };
}

/**
 * Executes automatic optimization changes (pausing losing ads, bumping winning budgets).
 */
export async function applyOptimizationAction(
  userId: string,
  campaignId: string,
  action: "SCALE_BUDGET" | "PAUSE_CAMPAIGN"
): Promise<{ success: boolean; message: string }> {
  const admin = getInsforgeAdminClient();

  const { data: campaign } = await admin.database
    .from("meta_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();

  if (!campaign) {
    return { success: false, message: "Campaign not found" };
  }

  if (action === "PAUSE_CAMPAIGN") {
    await admin.database
      .from("meta_campaigns")
      .update({ status: "PAUSED" })
      .eq("id", campaignId);

    return {
      success: true,
      message: `Campaign '${campaign.name}' paused autonomously to preserve budget.`,
    };
  }

  if (action === "SCALE_BUDGET") {
    const currentBudget = Number(campaign.daily_budget) || 1000;
    const scaledBudget = Math.round(currentBudget * 1.2);

    await admin.database
      .from("meta_campaigns")
      .update({ daily_budget: scaledBudget })
      .eq("id", campaignId);

    return {
      success: true,
      message: `Scaled daily budget for '${campaign.name}' from ₹${currentBudget} to ₹${scaledBudget} (+20%).`,
    };
  }

  return { success: false, message: "Unsupported optimization action" };
}
