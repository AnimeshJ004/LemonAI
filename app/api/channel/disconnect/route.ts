import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";
import { reportError } from "@/lib/observability";


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
                page_id: null,
                page_access_token: null,
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

        // Audit trail — a disconnect is a privacy-relevant event: OAuth tokens
        // are cleared and the user has revoked our access to that platform.
        void writeAuditEntry({
            userId,
            event: AUDIT_EVENT.CHANNEL_DISCONNECTED,
            resourceType: "user_channel",
            resourceId: userChannelId ?? undefined,
            metadata: {
                userChannelId: userChannelId ?? null,
                channelTypeId: channelTypeId ?? null,
            },
            ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            userAgent: request.headers.get("user-agent") ?? null,
        });

        return NextResponse.json({ success: true })

    } catch (error) {
        await reportError(error, { scope: "api/channel/disconnect" }, "error");
        return NextResponse.json({ error: "Failed to disconnect channel" }, { status: 500 });
    }
}
