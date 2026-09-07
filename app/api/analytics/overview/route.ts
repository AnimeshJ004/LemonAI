import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getInsforgeAdminClient();

    // Fetch data from existing tables safely
    const [postsRes, leadsRes, commentsRes] = await Promise.all([
      admin.database
        .from("scheduled_posts")
        .select("id, status, created_at, published_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin.database
        .from("leads")
        .select("id, stage, score, deal_value, source, created_at")
        .eq("user_id", targetUserId),
      admin.database
        .from("social_comments")
        .select("id, sentiment, created_at")
        .eq("user_id", targetUserId)
        .limit(100),
    ]);

    const posts = postsRes.data || [];
    const leads = leadsRes.data || [];
    const comments = commentsRes.data || [];

    // Calculate analytics
    const totalPosts = posts.length;
    const publishedPosts = posts.filter((p: any) => p.status === "published").length;
    const queuedPosts = posts.filter((p: any) => p.status === "queue").length;
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter((l: any) => ["qualified", "booked", "closed_won"].includes(l.stage)).length;
    const totalDealValue = leads.reduce((sum: number, l: any) => sum + (Number(l.deal_value) || 0), 0);
    const wonDeals = leads.filter((l: any) => l.stage === "closed_won");
    const wonRevenue = wonDeals.reduce((sum: number, l: any) => sum + (Number(l.deal_value) || 0), 0);

    const commentsByDay = comments.reduce((acc: Record<string, number>, c: any) => {
      const day = c.created_at?.slice(0, 10);
      if (day) acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    const postsByStatus = {
      published: publishedPosts,
      queued: queuedPosts,
      draft: posts.filter((p: any) => p.status === "draft").length,
    };

    const leadsByStage = ["new", "contacted", "qualified", "booked", "proposal", "closed_won", "closed_lost"]
      .map(stage => ({ stage, count: leads.filter((l: any) => l.stage === stage).length }));

    // Generate AI recommendations based on data
    let aiRecommendations: string[] = [];
    try {
      const { insforge } = await getInsforgeServerClient();
      const completion = await insforge.ai.chat.completions.create({
        model: "google/gemini-3.8-flash",
        messages: [{
          role: "user",
          content: `Analyze this social media performance data and give 3 specific actionable recommendations:
- Total posts: ${totalPosts}, Published: ${publishedPosts}
- Total leads: ${totalLeads}, Qualified: ${qualifiedLeads}
- Total pipeline value: ₹${totalDealValue}, Revenue won: ₹${wonRevenue}
- Comments processed: ${comments.length}

Return ONLY a JSON array of 3 recommendation strings (max 80 words each):
["recommendation 1", "recommendation 2", "recommendation 3"]`
        }]
      });
      const raw = completion.choices[0]?.message?.content || "[]";
      const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
      aiRecommendations = JSON.parse(clean);
    } catch {
      aiRecommendations = [
        "Keep publishing consistently — aim for 1-2 posts per day for best reach.",
        `You have ${Math.max(0, totalLeads - qualifiedLeads)} leads to qualify. Follow up with them to improve pipeline velocity.`,
        "Connect your Instagram & Facebook accounts in Settings to enable live analytics.",
      ];
    }

    return NextResponse.json({
      overview: { totalPosts, publishedPosts, queuedPosts, totalLeads, qualifiedLeads, totalDealValue, wonRevenue },
      postsByStatus,
      leadsByStage,
      commentsByDay,
      aiRecommendations,
    });
  } catch (error: any) {
    console.error("Analytics overview error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch analytics" }, { status: 500 });
  }
}
