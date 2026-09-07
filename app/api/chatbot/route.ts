import { NextRequest, NextResponse } from "next/server";
import { getInsforgeAdminClient, getInsforgeServerClient } from "@/lib/insforge-server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, userId, sessionId } = body;

    if (!message || !userId) {
      return NextResponse.json({ error: "message and userId required" }, { status: 400 });
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

      const { data: memory } = await admin.database
        .from("brand_memory")
        .select("memory_text")
        .eq("user_id", userId)
        .limit(5);

      memoryContext = memory?.map((m: any) => m.memory_text).join("\n") || "";
    } catch (e) {
      console.warn("Could not fetch brand profile or memory:", e);
    }

    const systemPrompt = `You are a helpful, courteous AI sales representative for ${brand?.business_name || "our company"}.
Business: ${brand?.business_name || "Leading Brand"}
Niche: ${brand?.niche || "Professional Services & Products"}
Main Offer: ${brand?.main_offer || "High-converting solutions tailored to your needs"}
Target Audience: ${brand?.target_audience || "Valued customers"}
${memoryContext ? `Additional Knowledge:\n${memoryContext}` : ""}

RULES:
- Answer inquiries politely about this business, its offers, and customer benefits.
- If someone expresses clear interest to buy, book, or get pricing, encourage them to share their name, email, or schedule a quick discovery call.
- Keep answers crisp, warm, and under 100 words.`;

    let reply = "Hello! I am your AI assistant. How can I help you today?";
    try {
      const { insforge } = await getInsforgeServerClient();
      const completion = await insforge.ai.chat.completions.create({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      });
      reply = completion.choices[0]?.message?.content || reply;
    } catch (aiErr) {
      console.warn("Chatbot AI generation error, using fallback:", aiErr);
      reply = `Thank you for your inquiry about ${brand?.business_name || "our services"}! We would be delighted to assist you with our latest offers. Could you share your email or preferred appointment time?`;
    }

    // Detect purchase intent keywords
    const intentKeywords = ["price", "buy", "cost", "book", "appointment", "contact", "purchase", "how much", "order", "quote"];
    const hasIntent = intentKeywords.some((k) => message.toLowerCase().includes(k));

    // Try to log to CRM tables if available (Member 3)
    if (hasIntent) {
      try {
        const { data: existingConv } = await admin.database
          .from("crm_conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("channel", "website")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const convId = existingConv?.id;
        if (convId) {
          await admin.database.from("crm_messages").insert([
            { conversation_id: convId, sender_type: "lead", content: message },
            { conversation_id: convId, sender_type: "ai_assistant", content: reply },
          ]);
        }
      } catch (crmErr) {
        // Safe to ignore if Member 3's tables are not yet created
      }
    }

    return NextResponse.json({ reply, hasIntent });
  } catch (error: any) {
    console.error("Website bot route error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
