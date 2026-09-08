import { NextRequest, NextResponse } from "next/server";
import { getBrandProfileForUser } from "@/lib/brand-helper";
import { routeAICall } from "@/lib/ai-router";
import {
  findOrCreateLeadByContact,
  createConversation,
  addMessage,
  getConversationWithMessages,
} from "@/lib/crm-service";
import { scoreAndUpdateLead } from "@/lib/lead-scoring";
import { generateCalcomBookingUrl } from "@/lib/calcom-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      message,
      conversationId,
      userId: passedUserId,
      visitorName,
      visitorEmail,
      visitorPhone,
    } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Determine tenant/brand user_id (from body, or default to system/first account for embed widget)
    const targetUserId = passedUserId || "user_lemon_default";

    // 1. Fetch brand profile for grounding
    const brand = await getBrandProfileForUser(targetUserId);
    const brandName = brand?.business_name || "Lemon AI";
    const niche = brand?.niche || "Autonomous Marketing & Social Media Automation";
    const targetAudience = brand?.target_audience || "Founders, agencies, and growth teams";
    const brandTone = brand?.brand_tone || "Friendly and Professional";
    const mainOffer = brand?.main_offer || "AI-powered social media generation, scheduling, and autonomous voice qualification";

    // 2. Extract potential contact details from message using regex
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = message.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const extractedEmail = visitorEmail || (emailMatch ? emailMatch[0] : null);
    const extractedPhone = visitorPhone || (phoneMatch ? phoneMatch[0] : null);

    // 3. Resolve or create lead and conversation
    let currentConvId = conversationId;
    let lead = null;

    if (extractedEmail || extractedPhone || visitorName) {
      lead = await findOrCreateLeadByContact({
        user_id: targetUserId,
        name: visitorName,
        email: extractedEmail || undefined,
        phone: extractedPhone || undefined,
        source: "website",
      });
    }

    if (!currentConvId) {
      const newConv = await createConversation({
        user_id: targetUserId,
        lead_id: lead?.id || null,
        channel: "website",
        is_ai_active: true,
      });
      currentConvId = newConv.id;
    }

    // 4. Retrieve conversation history for context
    const { conversation, messages: existingMsgs } = await getConversationWithMessages(
      currentConvId,
      targetUserId
    );

    // Record incoming visitor message
    await addMessage({
      conversation_id: currentConvId,
      sender_type: "lead",
      content: message.trim(),
    });

    // If human agent has taken over, do not auto-reply
    if (conversation && conversation.is_ai_active === false) {
      return NextResponse.json({
        conversationId: currentConvId,
        reply: "Our team has received your message and will reply shortly.",
        isHumanTakeover: true,
      });
    }

    // 5. Generate AI grounded reply
    const historyText = (existingMsgs || [])
      .slice(-6)
      .map((m) => `${m.sender_type === "lead" ? "Visitor" : "Assistant"}: ${m.content}`)
      .join("\n");

    const calLink = generateCalcomBookingUrl({
      leadName: visitorName,
      email: extractedEmail || undefined,
      phone: extractedPhone || undefined,
    });

    const systemPrompt = `You are the official conversational website assistant for ${brandName}.
Brand Niche: ${niche}
Target Audience: ${targetAudience}
Main Offerings: ${mainOffer}
Tone: ${brandTone}

Guidelines:
1. Answer visitor questions accurately, concisely, and enthusiastically based on the brand's profile.
2. Naturally qualify the prospect. If they haven't shared their contact info yet, ask:
   "What is the best email or phone number to send our detailed pricing breakdown and demo to?"
3. If they express high interest or want a live walk-through, suggest booking a quick 15-min discovery call using this link: ${calLink}
4. Keep answers punchy (2-4 sentences max). Never invent fake claims.`;

    const userPrompt = `Recent Conversation:
${historyText}
Visitor: ${message}

Provide the next assistant response:`;

    const aiRes = await routeAICall({
      task: "SHORTEN_REPHRASE",
      systemPrompt,
      userPrompt,
      preferredTier: "TIER_1_FAST",
      temperature: 0.5,
    });

    const replyText =
      aiRes.data && typeof aiRes.data === "string"
        ? aiRes.data.trim()
        : `Thank you for reaching out to ${brandName}! We specialize in ${mainOffer}. What is the best email or phone number to send our case studies and pricing sheet to?`;

    // 6. Record assistant reply
    await addMessage({
      conversation_id: currentConvId,
      sender_type: "ai_assistant",
      content: replyText,
    });

    // 7. If lead exists or was created, trigger background BANT scoring
    if (lead) {
      const fullTranscript = `${historyText}\nVisitor: ${message}\nAssistant: ${replyText}`;
      // Execute scoring asynchronously
      scoreAndUpdateLead(lead, fullTranscript, niche).catch((err) =>
        console.warn("Background scoring error:", err)
      );
    }

    return NextResponse.json({
      conversationId: currentConvId,
      reply: replyText,
      leadId: lead?.id || null,
      bookingUrl: calLink,
    });
  } catch (error: any) {
    console.error("Chatbot message processing error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to process chat message",
        reply: "Thanks for reaching out! Please leave your email and our team will get back to you shortly.",
      },
      { status: 500 }
    );
  }
}
