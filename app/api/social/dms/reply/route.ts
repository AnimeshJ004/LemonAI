import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { decrypt } from "@/lib/encryption";
import { getBrandBrainSummary, getBrandProfileForUser } from "@/lib/brand-helper";
import { callResilientCompletion } from "@/lib/ai-gateway";

/**
 * POST /api/social/dms/reply — send an AI-generated or manual reply to an Instagram/Facebook DM
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { conversationId, platform, recipientId, message, aiGenerate, context } = body;

    if (!conversationId || !platform || !recipientId) {
      return NextResponse.json({ error: "conversationId, platform, and recipientId are required" }, { status: 400 });
    }

    const admin = getInsforgeAdminClient();

    // Get access token for this platform
    const { data: channel } = await admin.database
      .from("user_channels")
      .select("*, channel_types(type)")
      .eq("user_id", targetUserId)
      .eq("channel_types.type", platform.toUpperCase())
      .single();

    let replyText = message;

    // Auto-generate AI reply if requested
    if (aiGenerate || !message) {
      const brand = await getBrandProfileForUser(targetUserId);
      const brandContext = getBrandBrainSummary(brand);

      const completion = await callResilientCompletion({
        jsonMode: false,
        messages: [
          {
            role: "system",
            content: `You are a helpful, warm, and professional social media assistant for this brand:\n\n${brandContext}\n\nRespond to customer DMs in a friendly, concise manner. If they express purchase intent, guide them to book a consultation. Keep replies under 150 words.`,
          },
          {
            role: "user",
            content: `Customer DM context: ${context || "General inquiry"}\n\nGenerate a helpful reply:`,
          },
        ],
      });

      replyText = (completion as any).text || (completion as any).data || message || "Thank you for reaching out! How can we help you today?";
    }

    if (!replyText) {
      return NextResponse.json({ error: "No reply message provided" }, { status: 400 });
    }

    // Send reply via Meta Graph API
    let sendSuccess = false;
    let sendError = "";

    if (channel?.access_token) {
      try {
        const accessToken = decrypt(channel.access_token);
        const accountId = channel.provider_account_id;

        const sendRes = await fetch(
          `https://graph.facebook.com/v22.0/${accountId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: recipientId },
              message: { text: replyText },
              messaging_type: "RESPONSE",
              access_token: accessToken,
            }),
          }
        );

        if (sendRes.ok) {
          sendSuccess = true;
        } else {
          const errData = await sendRes.json();
          sendError = errData?.error?.message || "Meta API rejected the reply";
        }
      } catch (apiErr: any) {
        sendError = apiErr.message;
      }
    } else {
      // Simulated reply for dev / no token
      sendSuccess = true;
      sendError = "Simulated (no access token)";
    }

    // Update conversation in DB as replied
    await admin.database
      .from("social_dms")
      .update({
        last_reply: replyText,
        last_replied_at: new Date().toISOString(),
        is_read: true,
        updated_at: new Date().toISOString(),
      })
      .eq("conversation_id", conversationId)
      .eq("user_id", targetUserId);

    return NextResponse.json({
      success: sendSuccess,
      replyText,
      note: sendError || undefined,
    });
  } catch (error: any) {
    console.error("DM Reply error:", error);
    return NextResponse.json({ error: error.message || "Failed to send DM reply" }, { status: 500 });
  }
}
