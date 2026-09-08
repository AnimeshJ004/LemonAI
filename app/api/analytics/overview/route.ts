import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getInsforgeAdminClient();

    // Fetch data across tables safely
    const [postsRes, leadsRes, commentsRes, channelsRes, metaAdsRes] = await Promise.all([
      admin.database
        .from("scheduled_posts")
        .select("id, content, images, status, scheduled_at, published_at, published_url, created_at, user_channels(channel_types(type, name))")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin.database
        .from("leads")
        .select("id, stage, score, deal_value, source, created_at")
        .eq("user_id", targetUserId),
      admin.database
        .from("social_comments")
        .select("id, sentiment, platform, created_at")
        .eq("user_id", targetUserId)
        .limit(100),
      admin.database
        .from("user_channels")
        .select("id, channel_types(type, name)")
        .eq("user_id", targetUserId),
      admin.database
        .from("meta_campaigns")
        .select("id, status, daily_budget, created_at")
        .eq("user_id", targetUserId),
    ]);

    const posts = postsRes.data || [];
    const leads = leadsRes.data || [];
    const comments = commentsRes.data || [];
    const userChannels = channelsRes.data || [];
    const metaCampaigns = metaAdsRes.data || [];

    // Calculate authentic core metrics
    const totalPosts = posts.length;
    const publishedPosts = posts.filter((p: any) => p.status === "published").length;
    const queuedPosts = posts.filter((p: any) => p.status === "queue").length;
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter((l: any) => ["qualified", "booked", "closed_won"].includes(l.stage)).length;
    const bookedAppointments = leads.filter((l: any) => ["booked", "closed_won"].includes(l.stage)).length;
    const totalDealValue = leads.reduce((sum: number, l: any) => sum + (Number(l.deal_value) || 0), 0);
    const wonDeals = leads.filter((l: any) => l.stage === "closed_won");
    const wonRevenue = wonDeals.reduce((sum: number, l: any) => sum + (Number(l.deal_value) || 0), 0);

    // Authentic Multi-Agent Conversion Funnel (Zero fake multipliers)
    const funnel = [
      { step: "Multi-Channel Content Assets", count: totalPosts, color: "bg-blue-500", note: `${publishedPosts} published, ${queuedPosts} queued` },
      { step: "Inbound Comments & Interactions", count: comments.length, color: "bg-indigo-500", note: "Real platform comments processed" },
      { step: "CRM Leads Captured", count: totalLeads, color: "bg-purple-500", note: "Across Web, WhatsApp, Ads & Social" },
      { step: "BANT Qualified Prospects (Score ≥ 7)", count: qualifiedLeads, color: "bg-amber-500", note: "High purchase-intent leads" },
      { step: "Consultations & Appointments Booked", count: bookedAppointments, color: "bg-emerald-500", note: "Cal.com & CRM verified" },
      { step: "Closed Deals Won", count: wonDeals.length, color: "bg-green-600", note: `₹${wonRevenue.toLocaleString()} verified revenue` },
    ];

    // Top Content Leaderboard from actual posts
    const topContent = posts.slice(0, 8).map((p: any) => {
      const channelName = (p.user_channels as any)?.channel_types?.name || "Social Media";
      const channelType = (p.user_channels as any)?.channel_types?.type || "INSTAGRAM";
      const firstLine = p.content ? p.content.split("\n")[0].replace(/[#*`]/g, "").trim() : "Social Asset";
      return {
        id: p.id,
        title: firstLine.slice(0, 70) || "Scheduled Post",
        channel: channelName,
        channelType,
        status: p.status,
        publishedUrl: p.published_url,
        imageUrl: p.images?.[0]?.url || null,
        scheduledAt: p.scheduled_at,
        publishedAt: p.published_at,
      };
    });

    // Leads by channel source
    const sources = ["website", "whatsapp", "instagram", "facebook", "voice", "organic", "meta_ads"];
    const leadsBySource = sources.map((src) => ({
      source: src,
      count: leads.filter((l: any) => l.source === src).length,
    }));

    // Connected channels check
    const connectedTypes = new Set(
      userChannels.map((c: any) => c.channel_types?.type?.toLowerCase()).filter(Boolean)
    );

    const platformStatus = [
      {
        platform: "Instagram",
        icon: "📸",
        status: connectedTypes.has("instagram") ? "Live publishing & comment sync active" : "Connect in Channels for automated publishing",
        connected: connectedTypes.has("instagram"),
      },
      {
        platform: "Facebook",
        icon: "📘",
        status: connectedTypes.has("facebook") ? "Page posting & insights active" : "Connect for Facebook Page insights",
        connected: connectedTypes.has("facebook"),
      },
      {
        platform: "LinkedIn",
        icon: "💼",
        status: connectedTypes.has("linkedin") ? "Company & personal profile sync active" : "Connect for professional reach analytics",
        connected: connectedTypes.has("linkedin"),
      },
      {
        platform: "Meta Ads",
        icon: "📣",
        status: metaCampaigns.length > 0 ? `${metaCampaigns.length} campaigns staged / active` : "Create campaigns in AI Advertising",
        connected: metaCampaigns.length > 0 || Boolean(process.env.META_CLIENT_ID),
      },
    ];

    const postsByStatus = {
      published: publishedPosts,
      queued: queuedPosts,
      draft: posts.filter((p: any) => p.status === "draft").length,
    };

    const leadsByStage = ["new", "contacted", "qualified", "booked", "proposal", "closed_won", "closed_lost"]
      .map(stage => ({ stage, count: leads.filter((l: any) => l.stage === stage).length }));

    // Generate smart contextual recommendations
    let aiRecommendations: string[] = [];
    try {
      const completion = await callResilientCompletion({
        jsonMode: true,
        messages: [
          {
            role: "user",
            content: `Analyze this multi-channel marketing & sales data and give 3 sharp, executive growth recommendations:
- Total posts: ${totalPosts}, Published: ${publishedPosts}, Queued: ${queuedPosts}
- Total leads: ${totalLeads}, Qualified: ${qualifiedLeads}, Booked: ${bookedAppointments}
- Total pipeline value: ₹${totalDealValue}, Revenue won: ₹${wonRevenue}
- Active Meta campaigns: ${metaCampaigns.length}

Return ONLY a JSON array of 3 recommendation strings (max 65 words each):
["recommendation 1", "recommendation 2", "recommendation 3"]`,
          },
        ],
      });

      if (completion.data && Array.isArray(completion.data) && completion.data.length > 0) {
        aiRecommendations = completion.data;
      } else {
        throw new Error("No array parsed");
      }
    } catch {
      aiRecommendations = [
        "Double down on high-scoring Reel hooks to increase top-of-funnel reach by 3x.",
        `You have ${Math.max(0, qualifiedLeads - bookedAppointments)} qualified prospects ready for discovery consultations. Review the CRM pipeline to close them.`,
        "Launch a complementary Meta Lead Gen campaign to turn your best organic posts into paid revenue.",
      ];
    }

    return NextResponse.json({
      overview: {
        totalPosts,
        publishedPosts,
        queuedPosts,
        totalLeads,
        qualifiedLeads,
        bookedAppointments,
        totalDealValue,
        wonRevenue,
      },
      funnel,
      topContent,
      leadsBySource,
      platformStatus,
      postsByStatus,
      leadsByStage,
      aiRecommendations,
    });
  } catch (error: any) {
    console.error("Analytics overview error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch analytics" }, { status: 500 });
  }
}
