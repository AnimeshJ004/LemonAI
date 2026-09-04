import { getInsforgeServerClient } from "@/lib/insforge-server";
import { NextRequest, NextResponse } from "next/server";

// In-memory cache for static channel types (1 hour TTL)
let cachedChannelTypes: any[] | null = null;
let lastChannelTypesFetch = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
    try {
        const {insforge, userId} = await getInsforgeServerClient()
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const filter = request.nextUrl.searchParams.get('filter')
        const now = Date.now();

        // 1. Fetch static channel types from cache or DB
        let channelTypes = cachedChannelTypes;
        if (!channelTypes || now - lastChannelTypesFetch > CACHE_TTL_MS) {
            const typesRes = await insforge.database
                .from("channel_types")
                .select("*")
                .order("created_at", { ascending: true });

            channelTypes = typesRes.data ?? [];
            if (channelTypes.length === 0) {
                const defaultChannelTypes = [
                    { type: 'TWITTER', name: 'Twitter / X', color: '#000000', character_limit: 280 },
                    { type: 'LINKEDIN', name: 'LinkedIn', color: '#2867b2', character_limit: 3000 },
                    { type: 'INSTAGRAM', name: 'Instagram', color: '#E4405F', character_limit: 2200 },
                    { type: 'THREADS', name: 'Threads', color: '#000000', character_limit: 500 },
                    { type: 'FACEBOOK', name: 'Facebook', color: '#1877F2', character_limit: 63206 },
                    { type: 'BLUESKY', name: 'Bluesky', color: '#1285fe', character_limit: 300 },
                    { type: 'YOUTUBE', name: 'YouTube', color: '#FF0000', character_limit: 100 },
                    { type: 'TIKTOK', name: 'Tiktok', color: '#000000', character_limit: 100 }
                ];

                const seedRes = await insforge.database
                    .from("channel_types")
                    .insert(defaultChannelTypes)
                    .select();
                if (seedRes.data && seedRes.data.length > 0) {
                    channelTypes = seedRes.data;
                }
            }
            cachedChannelTypes = channelTypes;
            lastChannelTypesFetch = now;
        }

        // 2. Fetch authenticated user's channels (isolated to this userId)
        const userChannelsRes = await insforge.database
            .from("user_channels")
            .select("*")
            .eq("user_id", userId);

        const userChannels = userChannelsRes.data ?? [];
        const userChannelMap = new Map(
            userChannels.map(channel => 
                [
                    channel.channel_type_id, 
                    channel
                ]
            )
        );

        let channels = channelTypes.map(channel_type => {
            const userChannel = userChannelMap.get(channel_type.id);
            return {
              id: channel_type.id,
              type: channel_type.type,
              name: channel_type.name,
              color: channel_type.color,
              character_limit: channel_type.character_limit,
              user_channel_id: userChannel?.id ?? null,
              handle: userChannel?.handle ?? null,
              profile_image: userChannel?.profile_image ?? null,
              profile_url: userChannel?.profile_url ?? null,
              connected: Boolean(userChannel?.is_connected)
            };
        });

        const totalChannels = channelTypes.length;
        const connectedCount = channels.filter(channel => channel.connected).length;

        if(filter === 'connected') {
            channels = channels.filter(channel => channel.connected);
        } else if(filter === 'unconnected') {
            channels = channels.filter(channel => !channel.connected);
        }

        return NextResponse.json({
            channels,
            totalChannels,
            connectedCount
        });
        
    } catch (error) {
        console.error('Error fetching channels:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
