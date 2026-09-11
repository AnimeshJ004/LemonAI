import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
    try {
        const { insforge, userId } = await getInsforgeServerClient();
        if (!userId) {
            return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
        }
        const { userChannelId, channelTypeId } = await request.json();

        if (!userChannelId && !channelTypeId) {
            return NextResponse.json({ error: "User channel ID or channel type ID is required" }, { status: 400 });
        }

        let updateQuery = insforge.database
            .from("user_channels")
            .update({
                access_token: null,
                refresh_token: null,
                token_expires_at: null,
                handle: null,
                profile_image: null,
                profile_url: null,
                provider_account_id: null,
                is_connected: false,
                is_active: false
            })
            .eq("user_id", userId);

        if (userChannelId) {
            updateQuery = updateQuery.eq("id", userChannelId);
        } else if (channelTypeId) {
            updateQuery = updateQuery.eq("channel_type_id", channelTypeId);
        }

        const { error: updateError } = await updateQuery;

        if (updateError) {
            throw updateError;
        }
        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Error disconnecting channel:", error);
        return NextResponse.json({ error: "Failed to disconnect channel" }, { status: 500 });
    }
}