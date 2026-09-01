import { ChannelTypeEnum } from "@/constants/channels";
import { encrypt } from "@/lib/encryption";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { getOAuthProvider, isProviderConfigured } from "@/lib/social-oauth";
import { createPkcePair, getPkceCookieName } from "@/lib/social-oauth/pkce";
import { createOAuthState } from "@/lib/social-oauth/state";
import { BskyAgent } from "@atproto/api";
import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL 

export async function POST(request: NextRequest) {
    try {
        const {insforge, userId} = await getInsforgeServerClient();
        if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 401 });

        const body = await request.json();
        const { channelTypeId, handle, password, accessToken, providerAccountId, isManual, isDemo } = body;
        if(!channelTypeId) return NextResponse.json({ error: 'Channel type ID is required' }, { status: 400 });

        const {data:channelType, error} = await insforge.database
            .from("channel_types")
            .select("id, type, name")
            .eq("id", channelTypeId)
            .single();

        if(error || !channelType) {
            return NextResponse.json({ error: 'Channel type not found' }, { status: 404 });
        }

        const redirectTo = `${APP_URL}/settings?tab=channels`;

        // 1. Direct Bluesky login verification with BskyAgent
        if (channelType.type === ChannelTypeEnum.BLUESKY && (password || (handle && password))) {
            const rawIdentifier = (handle || process.env.BLUESKY_IDENTIFIER || "").trim();
            const rawPassword = (password || process.env.BLUESKY_APP_PASSWORD || "").trim();

            if (!rawIdentifier || !rawPassword) {
                return NextResponse.json({ error: "Bluesky handle and App Password are required" }, { status: 400 });
            }

            const cleanIdentifier = rawIdentifier.replace(/^@/, '').trim();
            const agent = new BskyAgent({ service: "https://bsky.social" });

            try {
                await agent.login({
                    identifier: cleanIdentifier,
                    password: rawPassword,
                });

                const profileRes = await agent.getProfile({ actor: cleanIdentifier }).catch(() => null);
                const profileImage = profileRes?.data?.avatar || null;
                const formattedHandle = cleanIdentifier.startsWith("@") ? cleanIdentifier : `@${cleanIdentifier}`;
                const encryptedPass = encrypt(rawPassword);

                await insforge.database
                    .from("user_channels")
                    .upsert([
                        {
                            user_id: userId,
                            channel_type_id: channelType.id,
                            handle: formattedHandle,
                            access_token: encryptedPass,
                            profile_image: profileImage,
                            is_connected: true,
                            is_active: true,
                            updated_at: new Date().toISOString(),
                        }
                    ], { onConflict: "user_id,channel_type_id" });

                return NextResponse.json({
                    success: true,
                    connected: true,
                    channelType: channelType.type,
                    handle: formattedHandle,
                    profileImage,
                    url: `${APP_URL}/settings?tab=channels&connected=true&channelType=${channelType.type}`
                });
            } catch (bskyErr: any) {
                console.error("Bluesky login failed:", bskyErr);
                return NextResponse.json({
                    error: bskyErr?.message || "Invalid Bluesky handle or app password. Please check and try again."
                }, { status: 400 });
            }
        }

        // 2. Direct manual credential connection for other platforms (Twitter, LinkedIn, Instagram, etc.)
        if (isManual && handle) {
            const formattedHandle = handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`;
            const encryptedToken = accessToken ? encrypt(accessToken.trim()) : null;

            await insforge.database
                .from("user_channels")
                .upsert([
                    {
                        user_id: userId,
                        channel_type_id: channelType.id,
                        handle: formattedHandle,
                        access_token: encryptedToken,
                        provider_account_id: providerAccountId || null,
                        is_connected: true,
                        is_active: true,
                        updated_at: new Date().toISOString(),
                    }
                ], { onConflict: "user_id,channel_type_id" });

            return NextResponse.json({
                success: true,
                connected: true,
                channelType: channelType.type,
                handle: formattedHandle,
                url: `${APP_URL}/settings?tab=channels&connected=true&channelType=${channelType.type}`
            });
        }

        // 3. Direct connect for Bluesky using fallback .env.local credentials
        if (channelType.type === ChannelTypeEnum.BLUESKY && process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD) {
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

            return NextResponse.json({
                success: true,
                connected: true,
                channelType: channelType.type,
                url: `${APP_URL}/settings?tab=channels&connected=true&channelType=${channelType.type}`
            });
        }

        // 4. Real OAuth Authorization Flow (if configured)
        const isConfigured = isProviderConfigured(channelType.type as ChannelTypeEnum);

        if (isConfigured && !isDemo) {
            try {
                const provider = getOAuthProvider(channelType.type as ChannelTypeEnum);
                const state = createOAuthState({
                    userId,
                    channelTypeId: channelType.id,
                    channelType: channelType.type,
                    redirectTo,
                });

                const callbackUrl = `${APP_URL}/api/channel/callback`;
                const pkce = channelType.type === ChannelTypeEnum.TWITTER ? createPkcePair() : null;

                const url = provider.getAuthorizationUrl({
                    state,
                    redirectUri: callbackUrl,
                    codeChallenge: pkce?.codeChallenge,
                    codeChallengeMethod: pkce?.codeChallengeMethod,
                });

                const response = NextResponse.json({ url, isOAuth: true });

                if (pkce) {
                    response.cookies.set(getPkceCookieName(state), pkce.codeVerifier, {
                        httpOnly: true,
                        secure: true,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 60 * 10,
                    });
                }

                return response;
            } catch (providerErr) {
                console.error("Provider auth url generation failed:", providerErr);
            }
        }

        // 5. Development Demo Fallback
        const demoHandle = `@demo_${channelType.type.toLowerCase()}`;
        await insforge.database
            .from("user_channels")
            .upsert([
                {
                    user_id: userId,
                    channel_type_id: channelType.id,
                    handle: demoHandle,
                    is_connected: true,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                }
            ], { onConflict: "user_id,channel_type_id" });

        return NextResponse.json({
            success: true,
            connected: true,
            demo: true,
            channelType: channelType.type,
            url: `${APP_URL}/settings?tab=channels&connected=true&channelType=${channelType.type}&demo=true`
        });
        
    } catch (error: any) {
        console.error('Error connecting channel:', error);
        return NextResponse.json({ error: error?.message || 'Failed to connect channel' }, { status: 500 });
    }
}

