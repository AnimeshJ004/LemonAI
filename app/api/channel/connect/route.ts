import { ChannelTypeEnum } from "@/constants/channels";
import { encrypt } from "@/lib/encryption";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { BskyAgent } from "@atproto/api";
import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL 

export async function POST(request: NextRequest) {
    try {
        const {insforge, userId} = await getInsforgeServerClient();
        if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 401 });

        const body = await request.json();
        const { channelTypeId, handle, password, accessToken, providerAccountId } = body;
        if(!channelTypeId) return NextResponse.json({ error: 'Channel type ID is required' }, { status: 400 });

        const {data:channelType, error} = await insforge.database
            .from("channel_types")
            .select("id, type, name")
            .eq("id", channelTypeId)
            .single();

        if(error || !channelType) {
            return NextResponse.json({ error: 'Channel type not found' }, { status: 404 });
        }

        // 1. Bluesky Verification & Direct Connection
        if (channelType.type === ChannelTypeEnum.BLUESKY) {
            const rawIdentifier = (handle || "").trim();
            const rawPassword = (password || "").trim();

            if (!rawIdentifier || !rawPassword) {
                return NextResponse.json({ 
                    error: "Please enter both your Bluesky Handle (e.g. username.bsky.social) and App Password." 
                }, { status: 400 });
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
                });
            } catch (bskyErr: any) {
                console.error("Bluesky login failed:", bskyErr);
                return NextResponse.json({
                    error: bskyErr?.message || "Invalid Bluesky handle or app password. Please check and try again."
                }, { status: 400 });
            }
        }

        // 2. Real Credentials Connection for Instagram, Facebook, Twitter, LinkedIn, Threads, YouTube, TikTok
        const rawHandle = (handle || "").trim();
        const rawToken = (accessToken || "").trim();
        const rawAccountId = (providerAccountId || "").trim();

        if (!rawHandle) {
            return NextResponse.json({ 
                error: `Please enter your ${channelType.name} account username, handle, or page name.` 
            }, { status: 400 });
        }

        if (!rawToken) {
            return NextResponse.json({ 
                error: `Please enter your ${channelType.name} Access Token or API Key.` 
            }, { status: 400 });
        }

        let profileImage: string | null = null;
        let verifiedAccountId = rawAccountId || null;

        // Try to fetch profile image / verify token if Meta or Twitter
        if (channelType.type === ChannelTypeEnum.INSTAGRAM || channelType.type === ChannelTypeEnum.FACEBOOK) {
            try {
                const metaRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${encodeURIComponent(rawToken)}`);
                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    profileImage = metaData?.picture?.data?.url || null;
                    if (!verifiedAccountId && metaData?.id) {
                        verifiedAccountId = metaData.id;
                    }
                }
            } catch (metaErr) {
                console.warn("Meta verification request failed:", metaErr);
            }
        }

        const formattedHandle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
        const encryptedToken = encrypt(rawToken);

        await insforge.database
            .from("user_channels")
            .upsert([
                {
                    user_id: userId,
                    channel_type_id: channelType.id,
                    handle: formattedHandle,
                    access_token: encryptedToken,
                    provider_account_id: verifiedAccountId,
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
        });
        
    } catch (error: any) {
        console.error('Error connecting channel:', error);
        return NextResponse.json({ error: error?.message || 'Failed to connect channel' }, { status: 500 });
    }
}

