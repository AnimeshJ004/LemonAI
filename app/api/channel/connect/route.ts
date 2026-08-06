import { ChannelTypeEnum } from "@/constants/channels";
import { encrypt } from "@/lib/encryption";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { getOAuthProvider } from "@/lib/social-oauth";
import { createPkcePair, getPkceCookieName } from "@/lib/social-oauth/pkce";
import { createOAuthState } from "@/lib/social-oauth/state";
import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL 

export async function POST(request: NextRequest) {
    try {
        const {insforge, userId} = await getInsforgeServerClient();
        if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 401 });

        const {channelTypeId} = await request.json();
        if(!channelTypeId) return NextResponse.json({ error: 'Channel type ID is required' }, { status: 400 });

        const {data:channelType, error} = await insforge.database
            .from("channel_types")
            .select("id, type")
            .eq("id", channelTypeId)
            .single();

            if(error || !channelType) {
                return NextResponse.json({ error: 'Channel type not found' }, { status: 404 });
            }

            // Direct connect for Bluesky using .env.local credentials if OAuth config is not set up
            if (channelType.type === ChannelTypeEnum.BLUESKY && process.env.BLUESKY_IDENTIFIER) {
                const bskyHandle = process.env.BLUESKY_IDENTIFIER;
                const formattedHandle = bskyHandle.startsWith("@") ? bskyHandle : `@${bskyHandle}`;
                const encryptedPass = encrypt(process.env.BLUESKY_APP_PASSWORD);

                await insforge.database
                    .from("user_channels")
                    .upsert([
                        {
                            user_id: userId,
                            channel_type_id: channelType.id,
                            handle: formattedHandle,
                            access_token: encryptedPass,
                            is_connected: true,
                            is_active: true,
                            updated_at: new Date().toISOString(),
                        }
                    ], { onConflict: "user_id,channel_type_id" });

                return NextResponse.json({ url: `${APP_URL}/settings?connected=true&channelType=${channelType.type}` });
            }

            const redirectTo = `${APP_URL}/settings`;

        try {
            const provider = getOAuthProvider(channelType.type as ChannelTypeEnum);
            const state = createOAuthState({
                userId,
                channelTypeId: channelType.id,
                channelType: channelType.type,
                redirectTo,
            })

            const callbackUrl = `${APP_URL}/api/channel/callback`
            const pkce = channelType.type === ChannelTypeEnum.TWITTER ? createPkcePair() : null

            const url = provider.getAuthorizationUrl({
                state,
                redirectUri: callbackUrl,
                codeChallenge: pkce?.codeChallenge,
                codeChallengeMethod: pkce?.codeChallengeMethod,
            })

            const response = NextResponse.json({ url })

            if (pkce) {
                response.cookies.set(getPkceCookieName(state), pkce.codeVerifier, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 60 * 10,
                })
            }

            return response;
        } catch {
            const handle = channelType.type === ChannelTypeEnum.BLUESKY && process.env.BLUESKY_IDENTIFIER
                ? (process.env.BLUESKY_IDENTIFIER.startsWith("@") ? process.env.BLUESKY_IDENTIFIER : `@${process.env.BLUESKY_IDENTIFIER}`)
                : `@demo_${channelType.type.toLowerCase()}`;

            const accessToken = channelType.type === ChannelTypeEnum.BLUESKY && process.env.BLUESKY_APP_PASSWORD
                ? encrypt(process.env.BLUESKY_APP_PASSWORD)
                : null;

            // Development fallback: auto-connect demo channel if OAuth credentials are not set up
            await insforge.database
                .from("user_channels")
                .upsert([
                    {
                        user_id: userId,
                        channel_type_id: channelType.id,
                        handle,
                        access_token: accessToken,
                        is_connected: true,
                        is_active: true,
                        updated_at: new Date().toISOString(),
                    }
                ], { onConflict: "user_id,channel_type_id" });

            return NextResponse.json({ url: `${APP_URL}/settings?connected=true&channelType=${channelType.type}` });
        }
        
    } catch (error) {
        console.error('Error connecting channel:', error);
        return NextResponse.json({ error: 'Failed to connect channel' }, { status: 500 });
    }
}

