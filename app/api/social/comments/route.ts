import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

export const maxDuration = 30;

// GET: Fetch all comment logs for this user
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("social_comments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("Failed to fetch social_comments:", error.message);
      return NextResponse.json({ comments: [] });
    }
    return NextResponse.json({ comments: data || [] });
  } catch (err) {
    console.warn("Error fetching social comments:", err);
    return NextResponse.json({ comments: [] });
  }
}

// POST: Process a comment and generate AI reply
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { commentText, commenterHandle, platform, postId } = body;

  if (!commentText) return NextResponse.json({ error: "commentText required" }, { status: 400 });

  let aiResult = {
    sentiment: "INQUIRY",
    reply: "Thanks for reaching out! We'd love to help you. Check your DMs for details! 🙏",
    shouldSendDM: false,
    dmMessage: ""
  };

  try {
    const { insforge } = await getInsforgeServerClient();

    // AI: Analyze sentiment and generate reply
    const completion = await insforge.ai.chat.completions.create({
      model: "google/gemini-3.8-flash",
      messages: [{
        role: "user",
        content: `Analyze this social media comment and respond professionally in brand voice.
Comment: "${commentText}"
Platform: ${platform || "INSTAGRAM"}

Return ONLY valid JSON:
{
  "sentiment": "INQUIRY|PRAISE|COMPLAINT|SPAM|NEUTRAL",
  "reply": "Your brand-voice reply (max 150 chars for Instagram)",
  "shouldSendDM": true,
  "dmMessage": "Private DM message if purchase intent detected"
}`
      }]
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const clean = raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object") {
      aiResult = {
        sentiment: parsed.sentiment || "NEUTRAL",
        reply: parsed.reply || "Thank you for reaching out! 🙏",
        shouldSendDM: Boolean(parsed.shouldSendDM),
        dmMessage: parsed.dmMessage || ""
      };
    }
  } catch (err) {
    console.warn("AI generation failed for comment reply, using fallback:", err);
    const lower = commentText.toLowerCase();
    if (lower.includes("price") || lower.includes("cost") || lower.includes("how much") || lower.includes("buy")) {
      aiResult = {
        sentiment: "INQUIRY",
        reply: "Sent you a DM with complete pricing details! 📩",
        shouldSendDM: true,
        dmMessage: "Hey! Thanks for inquiring. Here are our special packages..."
      };
    } else if (lower.includes("love") || lower.includes("awesome") || lower.includes("great") || lower.includes("amazing")) {
      aiResult = {
        sentiment: "PRAISE",
        reply: "Thank you so much! We really appreciate the love! ❤️",
        shouldSendDM: false,
        dmMessage: ""
      };
    }
  }

  // Save to DB (resilient if table not yet migrated)
  try {
    const admin = getInsforgeAdminClient();
    await admin.database.from("social_comments").insert({
      user_id: userId,
      post_id: postId || null,
      platform: platform || "INSTAGRAM",
      commenter_handle: commenterHandle || "@user",
      comment_text: commentText,
      sentiment: aiResult.sentiment,
      reply_text: aiResult.reply,
      dm_sent: aiResult.shouldSendDM,
      status: "replied",
    });
  } catch (dbErr) {
    console.warn("Could not insert comment log into DB:", dbErr);
  }

  return NextResponse.json({
    success: true,
    reply: aiResult.reply,
    sentiment: aiResult.sentiment,
    shouldSendDM: aiResult.shouldSendDM,
    dmMessage: aiResult.dmMessage
  });
}
