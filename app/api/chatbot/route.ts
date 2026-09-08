import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { callResilientCompletion } from "@/lib/ai-gateway";
import { evaluateBANTLeadScore } from "@/lib/lead-scoring";

export const maxDuration = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, userId, sessionId } = body;

    if (!message || !userId) {
      return NextResponse.json(
        { error: "message and userId required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const admin = getInsforgeAdminClient();

    // Fetch brand profile for this user to ground the chatbot
    let brand: any = null;
    let memoryContext = "";

    try {
      const { data: brandData } = await admin.database
        .from("brand_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      brand = brandData;

      // Query ai_memory table (contains learned insights and brand context)
      const { data: memory } = await admin.database
        .from("ai_memory")
        .select("learned_insight, feedback_text")
        .eq("user_id", userId)
        .limit(5);

      memoryContext = memory
        ?.map((m: any) => m.learned_insight || m.feedback_text)
        .filter(Boolean)
        .join("\n") || "";
    } catch (e) {
      console.warn("Could not fetch brand profile or memory:", e);
    }

    const bookingUrl = brand?.booking_url || "";
    const productsInfo = brand?.products_services || "";
    const pricingInfo = brand?.pricing_details || "";
    const locationInfo = brand?.location || "";

    const systemPrompt = `You are a helpful, courteous AI sales and consultation representative for ${brand?.business_name || "our company"}.
Business: ${brand?.business_name || "Leading Brand"}
Niche: ${brand?.niche || "Professional Services & Products"}
Main Offer: ${brand?.main_offer || "High-converting solutions tailored to your needs"}
Target Audience: ${brand?.target_audience || "Valued customers"}
${locationInfo ? `Service Area / Location: ${locationInfo}` : ""}
${productsInfo ? `Products & Services Catalog:\n${productsInfo}` : ""}
${pricingInfo ? `Pricing Details & Guarantee:\n${pricingInfo}` : ""}
${bookingUrl ? `Official Calendar Booking URL: ${bookingUrl}` : ""}
${memoryContext ? `Additional Knowledge:\n${memoryContext}` : ""}

RULES:
- Answer inquiries politely about this business, its offers, products, and customer benefits.
- If someone asks to book an appointment, schedule a consultation, or talk to a founder/expert${bookingUrl ? `, provide their official booking link: ${bookingUrl}` : ""}.
- If someone expresses clear interest to buy, encourage them to share their name, email, or book directly.
- Keep answers crisp, warm, helpful, and under 90 words.`;

    let reply = "Hello! I am your AI assistant. How can I help you today?";
    try {
      const completion = await callResilientCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      });
      if (completion.content) {
        reply = completion.content;
      }
    } catch (aiErr) {
      console.warn("Chatbot AI generation error, using fallback:", aiErr);
      reply = `Thank you for reaching out to ${brand?.business_name || "our team"}! We would be delighted to assist you with our latest offers.${bookingUrl ? ` You can book an appointment directly here: ${bookingUrl}` : " Could you share your email or preferred time?"}`;
    }

    // Detect purchase intent keywords & contact info
    const intentKeywords = ["price", "buy", "cost", "book", "appointment", "contact", "purchase", "how much", "order", "quote"];
    const hasIntent = intentKeywords.some((k) => message.toLowerCase().includes(k));

    // Extract email or phone if provided by visitor
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = message.match(/(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/);
    const extractedEmail = emailMatch ? emailMatch[0] : null;
    const extractedPhone = phoneMatch ? phoneMatch[0] : null;

    // Log to CRM tables & create lead with BANT qualification
    try {
      let convId: string | null = null;
      let leadId: string | null = null;

      // Check if lead already exists or create new
      if (extractedEmail || extractedPhone || hasIntent) {
        let existingLeadQuery = admin.database
          .from("leads")
          .select("id, metadata, score, stage")
          .eq("user_id", userId);

        if (extractedEmail) {
          existingLeadQuery = existingLeadQuery.eq("email", extractedEmail);
        } else if (extractedPhone) {
          existingLeadQuery = existingLeadQuery.eq("phone", extractedPhone);
        }

        const { data: existingLead } = await existingLeadQuery.limit(1).maybeSingle();

        // Evaluate BANT intent score
        const bant = await evaluateBANTLeadScore({
          leadName: extractedEmail ? extractedEmail.split("@")[0] : "Website Visitor",
          transcript: message,
          niche: brand?.niche,
        });

        if (existingLead?.id) {
          leadId = existingLead.id;
          // Update existing lead with latest BANT score
          const currentMeta = existingLead.metadata || {};
          await admin.database
            .from("leads")
            .update({
              score: Math.max(existingLead.score || 0, bant.score),
              stage: bant.isQualified ? "qualified" : existingLead.stage,
              metadata: {
                ...currentMeta,
                bant,
              },
            })
            .eq("id", leadId);
        } else if (extractedEmail || extractedPhone || hasIntent) {
          const leadName = extractedEmail
            ? extractedEmail.split("@")[0]
            : `Website Visitor (${(sessionId || "").slice(0, 8) || "Web"})`;

          const { data: newLead } = await admin.database
            .from("leads")
            .insert({
              user_id: userId,
              name: leadName,
              email: extractedEmail,
              phone: extractedPhone,
              source: "website",
              stage: bant.isQualified ? "qualified" : "new",
              score: bant.score,
              deal_value: bant.isQualified ? 5000 : 2500,
              metadata: { sessionId: sessionId || undefined, bant },
            })
            .select("id")
            .single();

          leadId = newLead?.id || null;
        }
      }

      // Check for open conversation for this session/channel
      const { data: existingConv } = await admin.database
        .from("crm_conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("channel", "website")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConv?.id) {
        convId = existingConv.id;
        if (leadId) {
          await admin.database
            .from("crm_conversations")
            .update({ lead_id: leadId, last_message_at: new Date().toISOString() })
            .eq("id", convId);
        }
      } else {
        const { data: newConv } = await admin.database
          .from("crm_conversations")
          .insert({
            user_id: userId,
            lead_id: leadId,
            channel: "website",
            status: "open",
            is_ai_active: true,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        convId = newConv?.id || null;
      }

      if (convId) {
        await admin.database.from("crm_messages").insert([
          { conversation_id: convId, sender_type: "lead", content: message },
          { conversation_id: convId, sender_type: "ai_assistant", content: reply },
        ]);
      }
    } catch (crmErr) {
      console.warn("CRM auto-capture warning (safe fallback):", crmErr);
    }

    return NextResponse.json({ reply, hasIntent }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error("Website bot route error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

