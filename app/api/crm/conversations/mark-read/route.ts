import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { markConversationAsRead } from "@/lib/crm-service";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId = body.conversation_id || body.conversationId;

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversation_id is required" },
        { status: 400 }
      );
    }

    const success = await markConversationAsRead(conversationId, userId);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("Error marking conversation as read:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark conversation as read" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
