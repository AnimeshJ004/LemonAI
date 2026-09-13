import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getConversationsForUser,
  getConversationWithMessages,
  addMessage,
  toggleAIActive,
  createConversation,
} from "@/lib/crm-service";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { dispatchCRMOutboundMessage } from "@/lib/crm-outbound-dispatcher";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("id");

    if (conversationId) {
      const detail = await getConversationWithMessages(conversationId, targetUserId);
      if (!detail.conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      return NextResponse.json(detail);
    }

    const conversations = await getConversationsForUser(targetUserId);
    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { conversation_id, content, sender_type = "human_agent", channel, lead_id, action } = body;

    // Handle AI Reply action ("Let AI Reply")
    if (action === "ai_reply") {
      if (!conversation_id) {
        return NextResponse.json({ error: "conversation_id is required for ai_reply" }, { status: 400 });
      }

      const { conversation: conv, messages: existingMsgs } = await getConversationWithMessages(
        conversation_id,
        targetUserId
      );

      const lead = conv?.lead;
      const recentHistory = existingMsgs
        .slice(-6)
        .map((m) => `${m.sender_type === "lead" ? lead?.name || "Customer" : m.sender_type === "ai_assistant" ? "AI Agent" : "Human Agent"}: ${m.content}`)
        .join("\n");

      let aiReplyContent = "";
      try {
        const aiRes = await callResilientCompletion({
          messages: [
            {
              role: "system",
              content: `You are Lemon AI's autonomous omnichannel sales bot for an agency & AI marketing platform.
You are chatting with ${lead?.name || "the prospect"}${lead?.metadata?.company ? ` from ${lead.metadata.company}` : ""}.
Your tone is friendly, consultative, concise, and helpful.
Answer their questions, highlight autonomous content/lead qualification value, and gently suggest scheduling a 15-minute discovery session.
Keep the response to 2-3 sentences. Do not output markdown headers.`,
            },
            {
              role: "user",
              content: `Recent conversation:\n${recentHistory || (content ? `Customer: ${content}` : "Hello")}\n\nDraft the next conversational response.`,
            },
          ],
          temperature: 0.7,
        });

        if (aiRes.success && aiRes.content?.trim()) {
          aiReplyContent = aiRes.content.trim();
        }
      } catch (err) {
        console.warn("AI generation fallback:", err);
      }

      if (!aiReplyContent) {
        aiReplyContent = `Thanks for asking, ${lead?.name ? lead.name.split(" ")[0] : "there"}! We can seamlessly configure this automation to match your goals. Would you like to pick a quick slot on our demo calendar to walk through the setup?`;
      }

      await toggleAIActive(conversation_id, true, targetUserId);

      const message = await addMessage({
        conversation_id,
        sender_type: "ai_assistant",
        content: aiReplyContent,
      });

      const dispatch = await dispatchCRMOutboundMessage({
        conversationId: conversation_id,
        senderType: "ai_assistant",
        content: aiReplyContent,
        userId: targetUserId,
      });

      return NextResponse.json({ message, dispatch, success: true }, { status: 201 });
    }

    // If starting a brand new conversation
    if (!conversation_id && channel) {
      const newConv = await createConversation({
        user_id: targetUserId,
        lead_id,
        channel,
        is_ai_active: true,
      });

      if (content) {
        const message = await addMessage({
          conversation_id: newConv.id,
          sender_type,
          content,
        });

        const dispatch = await dispatchCRMOutboundMessage({
          conversationId: newConv.id,
          senderType: (sender_type === "human_agent" ? "human_agent" : "ai_assistant"),
          content,
          userId: targetUserId,
        });

        return NextResponse.json({ conversation: newConv, message, dispatch }, { status: 201 });
      }

      return NextResponse.json({ conversation: newConv }, { status: 201 });
    }

    if (!conversation_id || !content?.trim()) {
      return NextResponse.json(
        { error: "conversation_id and content are required" },
        { status: 400 }
      );
    }

    // When human agent sends a message, automatically pause AI to prevent conflicting responses
    if (sender_type === "human_agent") {
      await toggleAIActive(conversation_id, false, targetUserId);
    }

    const message = await addMessage({
      conversation_id,
      sender_type,
      content: content.trim(),
    });

    let dispatchResult: any = null;
    if (sender_type === "human_agent" || sender_type === "ai_assistant") {
      dispatchResult = await dispatchCRMOutboundMessage({
        conversationId: conversation_id,
        senderType: sender_type,
        content: content.trim(),
        userId: targetUserId,
      });
    }

    // If an incoming lead message arrives and AI autopilot is active, automatically generate AI reply
    if (sender_type === "lead") {
      try {
        const { conversation: currentConv, messages: history } = await getConversationWithMessages(
          conversation_id,
          targetUserId
        );

        if (currentConv?.is_ai_active !== false) {
          const lead = currentConv?.lead;
          const recentHistory = [...(history || [])]
            .slice(-6)
            .map((m) => `${m.sender_type === "lead" ? lead?.name || "Customer" : m.sender_type === "ai_assistant" ? "AI Agent" : "Human Agent"}: ${m.content}`)
            .join("\n");

          let aiText = "";
          try {
            const aiRes = await callResilientCompletion({
              messages: [
                {
                  role: "system",
                  content: `You are Lemon AI's autonomous omnichannel sales bot.
You are chatting with ${lead?.name || "the prospect"}${lead?.metadata?.company ? ` from ${lead.metadata.company}` : ""}.
Your tone is friendly, consultative, concise, and helpful.
Answer their questions directly in 2-3 sentences. Suggest scheduling a quick 15-minute walkthrough if appropriate.`,
                },
                {
                  role: "user",
                  content: `Recent chat history:\n${recentHistory}\n\nDraft the next conversational response.`,
                },
              ],
              temperature: 0.7,
            });
            if (aiRes.success && aiRes.content?.trim()) {
              aiText = aiRes.content.trim();
            }
          } catch {}

          if (!aiText) {
            aiText = `Hi ${lead?.name ? lead.name.split(" ")[0] : "there"}! Thanks for your message. We can seamlessly assist you with this. Would you like to schedule a quick 15-minute demo to explore further?`;
          }

          const aiReply = await addMessage({
            conversation_id,
            sender_type: "ai_assistant",
            content: aiText,
          });

          const aiDispatch = await dispatchCRMOutboundMessage({
            conversationId: conversation_id,
            senderType: "ai_assistant",
            content: aiText,
            userId: targetUserId,
          });

          return NextResponse.json({ message, aiReply, dispatch: aiDispatch }, { status: 201 });
        }
      } catch (autoErr) {
        console.warn("Auto AI reply notice:", autoErr);
      }
    }

    return NextResponse.json({ message, dispatch: dispatchResult }, { status: 201 });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    const targetUserId = userId || (process.env.NODE_ENV === "development" ? "user_lemon_default" : null);
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { conversation_id, is_ai_active } = body;

    if (!conversation_id || typeof is_ai_active !== "boolean") {
      return NextResponse.json(
        { error: "conversation_id and is_ai_active boolean are required" },
        { status: 400 }
      );
    }

    const updated = await toggleAIActive(conversation_id, is_ai_active, targetUserId);
    return NextResponse.json({ conversation: updated });
  } catch (error: any) {
    console.error("Error updating conversation AI status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update AI status" },
      { status: 500 }
    );
  }
}
