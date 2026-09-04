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
        let formattedHandle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;

        // 1. YouTube Verification & Real Channel Info Fetching
        if (channelType.type === ChannelTypeEnum.YOUTUBE) {
            const cleanYtHandle = rawHandle.replace(/^@/, '').trim();
            try {
                // Try 1: Direct YouTube API with mine=true
                const ytRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true", {
                    headers: {
                        Authorization: `Bearer ${rawToken}`,
                        Accept: "application/json"
                    }
                });
                if (ytRes.ok) {
                    const ytData = await ytRes.json();
                    const channelItem = ytData?.items?.[0];
                    if (channelItem) {
                        verifiedAccountId = channelItem.id;
                        profileImage = channelItem?.snippet?.thumbnails?.high?.url || channelItem?.snippet?.thumbnails?.medium?.url || channelItem?.snippet?.thumbnails?.default?.url || null;
                        if (channelItem?.snippet?.customUrl) {
                            const cleanCustom = channelItem.snippet.customUrl.replace(/^@/, '');
                            formattedHandle = `@${cleanCustom}`;
                        } else if (channelItem?.snippet?.title) {
                            formattedHandle = `@${channelItem.snippet.title.replace(/\s+/g, '')}`;
                        }
                    }
                }

                // Try 2: If mine=true yielded no image, query by forHandle
                if (!profileImage && cleanYtHandle) {
                    const handleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(cleanYtHandle)}`, {
                        headers: {
                            Authorization: `Bearer ${rawToken}`,
                            Accept: "application/json"
                        }
                    });
                    if (handleRes.ok) {
                        const handleData = await handleRes.json();
                        const channelItem = handleData?.items?.[0];
                        if (channelItem) {
                            verifiedAccountId = channelItem.id;
                            profileImage = channelItem?.snippet?.thumbnails?.high?.url || channelItem?.snippet?.thumbnails?.medium?.url || channelItem?.snippet?.thumbnails?.default?.url || null;
                        }
                    }
                }

                // Try 3: Google Userinfo API (User's Google Account Avatar)
                if (!profileImage) {
                    const gUserRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                        headers: {
                            Authorization: `Bearer ${rawToken}`,
                            Accept: "application/json"
                        }
                    });
                    if (gUserRes.ok) {
                        const gUserData = await gUserRes.json();
                        if (gUserData?.picture) {
                            profileImage = gUserData.picture;
                        }
                        if (!verifiedAccountId && gUserData?.sub) {
                            verifiedAccountId = gUserData.sub;
                        }
                    }
                }

                // Try 4: Public Unavatar fallback
                if (!profileImage && cleanYtHandle) {
                    profileImage = `https://unavatar.io/youtube/${cleanYtHandle}`;
                }
            } catch (ytErr) {
                console.warn("YouTube verification request failed:", ytErr);
                if (cleanYtHandle) {
                    profileImage = `https://unavatar.io/youtube/${cleanYtHandle}`;
                }
            }
        }

        // 2. Meta (Instagram & Facebook) Profile Fetching
        if (channelType.type === ChannelTypeEnum.INSTAGRAM || channelType.type === ChannelTypeEnum.FACEBOOK) {
            const cleanMetaHandle = rawHandle.replace(/^@/, '').trim();
            if (providerAccountId && typeof providerAccountId === "string") {
                verifiedAccountId = providerAccountId.trim();
            }

            try {
                // Try 1: Graph API me with instagram_business_account
                const metaRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,picture,username,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(rawToken)}`);
                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    profileImage = metaData?.instagram_business_account?.profile_picture_url || metaData?.picture?.data?.url || null;
                    if (!verifiedAccountId) {
                        verifiedAccountId = metaData?.instagram_business_account?.id || metaData?.id || null;
                    }
                    if (metaData?.instagram_business_account?.username) {
                        formattedHandle = `@${metaData.instagram_business_account.username.replace(/^@/, '')}`;
                    } else if (metaData?.username) {
                        formattedHandle = `@${metaData.username.replace(/^@/, '')}`;
                    }
                }

                // Try 2: me/accounts
                if (!verifiedAccountId || !profileImage) {
                    const accRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,picture,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(rawToken)}`);
                    if (accRes.ok) {
                        const accData = await accRes.json();
                        const pageItem = accData?.data?.find((p: any) => p.instagram_business_account?.id) || accData?.data?.[0];
                        if (pageItem) {
                            if (!verifiedAccountId) {
                                verifiedAccountId = pageItem?.instagram_business_account?.id || pageItem?.id || null;
                            }
                            if (!profileImage) {
                                profileImage = pageItem?.instagram_business_account?.profile_picture_url || pageItem?.picture?.data?.url || null;
                            }
                        }
                    }
                }

                // Try 3: Fallback to Instagram Basic Display API
                if ((!verifiedAccountId || !profileImage) && channelType.type === ChannelTypeEnum.INSTAGRAM) {
                    const igRes = await fetch(`https://graph.instagram.com/me?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(rawToken)}`);
                    if (igRes.ok) {
                        const igData = await igRes.json();
                        if (!profileImage) profileImage = igData?.profile_picture_url || null;
                        if (!verifiedAccountId && igData?.id) {
                            verifiedAccountId = igData.id;
                        }
                        if (igData?.username) {
                            formattedHandle = `@${igData.username.replace(/^@/, '')}`;
                        }
                    }
                }

                if (!profileImage && channelType.type === ChannelTypeEnum.INSTAGRAM && cleanMetaHandle) {
                    profileImage = `https://unavatar.io/instagram/${cleanMetaHandle}`;
                }
            } catch (metaErr) {
                console.warn("Meta verification request failed:", metaErr);
                if (channelType.type === ChannelTypeEnum.INSTAGRAM && cleanMetaHandle) {
                    profileImage = `https://unavatar.io/instagram/${cleanMetaHandle}`;
                }
            }
        }

        // 3. Twitter / X Profile Fetching
        if (channelType.type === ChannelTypeEnum.TWITTER) {
            const cleanTwHandle = rawHandle.replace(/^@/, '').trim();
            try {
                const twRes = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name", {
                    headers: {
                        Authorization: `Bearer ${rawToken}`,
                        Accept: "application/json"
                    }
                });
                if (twRes.ok) {
                    const twData = await twRes.json();
                    const twUser = twData?.data;
                    if (twUser) {
                        verifiedAccountId = twUser.id;
                        profileImage = twUser.profile_image_url ? twUser.profile_image_url.replace("_normal", "_400x400") : null;
                        if (twUser.username) {
                            formattedHandle = `@${twUser.username.replace(/^@/, '')}`;
                        }
                    }
                }

                if (!profileImage && cleanTwHandle) {
                    profileImage = `https://unavatar.io/x/${cleanTwHandle}`;
                }
            } catch (twErr) {
                console.warn("Twitter verification request failed:", twErr);
                if (cleanTwHandle) {
                    profileImage = `https://unavatar.io/x/${cleanTwHandle}`;
                }
            }
        }

        // 4. LinkedIn Profile Fetching
        if (channelType.type === ChannelTypeEnum.LINKEDIN) {
            try {
                const liRes = await fetch("https://api.linkedin.com/v2/userinfo", {
                    headers: {
                        Authorization: `Bearer ${rawToken}`,
                        Accept: "application/json"
                    }
                });
                if (liRes.ok) {
                    const liData = await liRes.json();
                    if (liData) {
                        verifiedAccountId = liData.sub || null;
                        profileImage = liData.picture || null;
                        if (liData.name && !rawHandle) {
                            formattedHandle = liData.name;
                        }
                    }
                }
            } catch (liErr) {
                console.warn("LinkedIn verification request failed:", liErr);
            }
        }

        // 5. Threads Profile Fetching
        if (channelType.type === ChannelTypeEnum.THREADS) {
            try {
                const thRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(rawToken)}`);
                if (thRes.ok) {
                    const thData = await thRes.json();
                    if (thData) {
                        verifiedAccountId = thData.id || null;
                        profileImage = thData.threads_profile_picture_url || null;
                        if (thData.username) {
                            formattedHandle = `@${thData.username.replace(/^@/, '')}`;
                        }
                    }
                }
            } catch (thErr) {
                console.warn("Threads verification request failed:", thErr);
            }
        }

        // 6. TikTok Profile Fetching
        if (channelType.type === ChannelTypeEnum.TIKTOK) {
            const cleanTtHandle = rawHandle.replace(/^@/, '').trim();
            try {
                const ttRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=avatar_url,display_name,username", {
                    headers: {
                        Authorization: `Bearer ${rawToken}`,
                        Accept: "application/json"
                    }
                });
                if (ttRes.ok) {
                    const ttData = await ttRes.json();
                    const ttUser = ttData?.data?.user;
                    if (ttUser) {
                        profileImage = ttUser.avatar_url || null;
                        if (ttUser.username) {
                            formattedHandle = `@${ttUser.username.replace(/^@/, '')}`;
                        }
                    }
                }

                if (!profileImage && cleanTtHandle) {
                    profileImage = `https://unavatar.io/tiktok/${cleanTtHandle}`;
                }
            } catch (ttErr) {
                console.warn("TikTok verification request failed:", ttErr);
                if (cleanTtHandle) {
                    profileImage = `https://unavatar.io/tiktok/${cleanTtHandle}`;
                }
            }
        }

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

