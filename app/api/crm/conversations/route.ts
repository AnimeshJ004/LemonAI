import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getConversationsForUser,
  getConversationWithMessages,
  addMessage,
  toggleAIActive,
  createConversation,
} from "@/lib/crm-service";

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
    const { conversation_id, content, sender_type = "human_agent", channel, lead_id } = body;

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
        return NextResponse.json({ conversation: newConv, message }, { status: 201 });
      }

      return NextResponse.json({ conversation: newConv }, { status: 201 });
    }

    if (!conversation_id || !content?.trim()) {
      return NextResponse.json(
        { error: "conversation_id and content are required" },
        { status: 400 }
      );
    }

    // When human agent sends a message, automatically pause AI to prevent simultaneous conflicting responses
    if (sender_type === "human_agent") {
      await toggleAIActive(conversation_id, false, targetUserId);
    }

    const message = await addMessage({
      conversation_id,
      sender_type,
      content: content.trim(),
    });

    return NextResponse.json({ message }, { status: 201 });
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
