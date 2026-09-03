import { getInsforgeServerClient } from "@/lib/insforge-server";
import { generateCostEffectiveIdeas } from "@/lib/ai-router";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";




export async function POST(request: NextRequest) {
    try {
        const { has, userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Allowed for all authenticated users
        const canUseAI = true;

        const { ideas, businessType, targetAudience, tone } = await request.json();
        const type = businessType || ideas;
        if (!type || !targetAudience) {
            return NextResponse.json({ error: "Missing businessType or targetAudience" }, { status: 400 });
        }

        const aiResponse = await generateCostEffectiveIdeas({
            businessType: type,
            targetAudience,
            tone,
            count: 3,
        });

        const generatedIdeas = aiResponse.data?.ideas || [];

        return NextResponse.json({ 
            ideas: generatedIdeas,
            metrics: aiResponse.metrics,
        });

    } catch (error) {
        console.error("Error generating ideas:", error)
        return NextResponse.json({ error: "Failed to generate ideas" }, { status: 500 })
    }
}
