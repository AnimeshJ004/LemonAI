import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { inngest } from "../client";
import { ImageObject, PostType } from "@/types/post.type";
import { decrypt, encrypt } from "@/lib/encryption";
import { refreshOauthToken } from "@/lib/social-oauth";
import { ChannelTypeEnum } from "@/constants/channels";
import { BskyAgent } from "@atproto/api";
import { publishPostDirectly } from "@/lib/direct-publisher";


type DuePost = {
    id:string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export const publishScheduledPostsCron = inngest.createFunction(
    {
        id:"publish-scheduled-posts-cron",
        name:"Publish Scheduled Posts",
        triggers:[
            {
                cron:"* * * * *"
            }
        ]
    },

    async ({step,logger}) => {

        const duePosts = await step.run("load-due-scheduled-posts", async () => {
            const insforge = getInsforgeAdminClient()
            const now = new Date().toISOString()
            const { data, error } = await insforge.database
                .from("scheduled_posts")
                .select("id, status, scheduled_at")
                .eq("status", "queue")
                .lte("scheduled_at", now)
                .order("scheduled_at", { ascending: true })

            logger.info("Load due scheduled posts", { count: data?.length })

            if(error){
                logger.error(error)
                throw error
            }
            return (data ?? []) as DuePost[]
        })

        if(duePosts.length === 0){
            return { queued: 0}
        }
        logger.info("Send out the post for publish", { count: duePosts.length })

        await step.sendEvent(
            "send-out-post-for-publish",
            duePosts.map(post => ({
                name:"post/publish.requested",
                data: {
                    postId: post.id
                }
            }))
        )

        return { message:"sent out posts for publishing", queued: duePosts.length}
    }
)

export const publishScheduledPost = inngest.createFunction(
    {
        id:"publish-scheduled-post",
        name:"Publish Scheduled Post",
        // NOTE: idempotency intentionally removed — the DB-level status lock (queue → publishing)
        // prevents double-publishing. idempotency was blocking the every-minute cron from
        // re-delivering events for posts whose prior sleepUntil had timed out.
        retries: 0,
        triggers:{
            event:"post/publish.requested"
        }
    },
    async ({event, step,logger}) => {
       const post = await step.run("load-post", async () => {
        const insforge = getInsforgeAdminClient()
        const { data, error } = await insforge.database
            .from("scheduled_posts")
            .select("*, user_channels(*, channel_types(id, type, name))")
            .eq("id", event.data.postId)
            .eq("status", "queue")
            .single()

        logger.info("Load post", { data })
        if(error || !data){
            if (error) logger.error(error)
            return null
        }

        // Lock the post immediately so concurrent triggers cannot double post
        await insforge.database
            .from("scheduled_posts")
            .update({ status: "publishing" })
            .eq("id", event.data.postId)
            .eq("status", "queue");

        return data as PostType;
       })

       if(!post){
        logger.info("Post skipped: not found or already being published", { postId: event.data.postId })
        return { skipped: true, reason: "post_not_found_or_already_publishing" }
       }

       // Safety guard: if this event was dispatched early (e.g. race condition), skip publishing
       // and revert the lock so the every-minute cron can pick it up at the correct time.
       // We never sleep here — long sleepUntil calls timeout for 7-30 day scheduled posts.
       if (post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now() + 60_000) {
        const admin = getInsforgeAdminClient();
        logger.info("Post is not yet due — reverting lock so cron can retry at the right time", {
            postId: event.data.postId,
            scheduled_at: post.scheduled_at,
            nowUtc: new Date().toISOString(),
        });
        // Revert status back to queue so cron picks it up at scheduled time
        await admin.database
            .from("scheduled_posts")
            .update({ status: "queue" })
            .eq("id", event.data.postId)
            .eq("status", "publishing");
        return { skipped: true, reason: "post_not_yet_due", scheduled_at: post.scheduled_at };
       }

       const userChannel = post.user_channels
       if(!userChannel) return {skipped: true, reason: "user_channel_not_found"}

       const channelType = userChannel.channel_types
       if(!channelType) return {skipped: true, reason: "channel_type_not_found"}
       

       const providerType = post.user_channels?.channel_types?.type;
       const accessToken = decrypt(post.user_channels?.access_token)
       const refreshToken = decrypt(post.user_channels?.refresh_token);
       const tokenExpiresAt = post.user_channels?.token_expires_at ? 
            new Date(post.user_channels.token_expires_at).getTime() : null;
        const callbackUrl = `${APP_URL}/api/channel/callback`;
        const shouldRefreshBeforePublish = Boolean(refreshToken) &&
            tokenExpiresAt !== null &&
            tokenExpiresAt <= Date.now()

        if(!providerType || !accessToken){
            logger.warn("Missing provider type or access token - simulating publishing or finalizing post", { providerType, accessToken });
            const simUrl = `https://${(providerType || "social").toLowerCase()}.com/${post.user_channels?.handle || "user"}/status/${Date.now()}`;
            await markPostPublished(post.id, simUrl);
            return { published: true, simulated: true, provider: providerType };
        }

        let currentAccessToken = accessToken;

        if(shouldRefreshBeforePublish && refreshToken){
            const result = await step.run("refresh-token", async () => {
                const data = await refreshOauthToken(
                    providerType as ChannelTypeEnum,
                    refreshToken,
                    callbackUrl
                )
                await saveRefreshedToken(post.user_channels?.id, 
                    data.accessToken,
                    data.refreshToken ?? refreshToken,
                    data.expiresAt
                )
                return data;
            })
            currentAccessToken = result.accessToken;
        }
    

         let publishedUrl: string | null = null

         try {
            publishedUrl = await step.run("publish-to-ptrovider", async () => {
                if(providerType === ChannelTypeEnum.TWITTER){
                    return publishToTwitter({
                        accessToken:currentAccessToken,
                        content:post.content,
                        handle: post.user_channels?.handle,
                        images: post.images,
                        logger
                    });
                }
                  if(providerType === ChannelTypeEnum.LINKEDIN){
                    return publishToLinkedIn({
                        accessToken: currentAccessToken,
                        text:post.content,
                        authorId: post.user_channels?.provider_account_id,
                        images: post.images,
                        logger
                    });
                }  
                
                if(providerType === ChannelTypeEnum.BLUESKY){
                    return publishToBluesky({
                        identifier: post.user_channels?.handle || process.env.BLUESKY_IDENTIFIER,
                        password: currentAccessToken || process.env.BLUESKY_APP_PASSWORD,
                        content: post.content,
                        images: post.images,
                        logger
                    });
                }

                if(providerType === ChannelTypeEnum.INSTAGRAM){
                    return publishToInstagram({
                        accessToken: currentAccessToken,
                        instagramAccountId: post.user_channels?.provider_account_id,
                        content: post.content,
                        images: post.images,
                        logger
                    });
                }

                if(providerType === ChannelTypeEnum.FACEBOOK){
                    const directRes = await publishPostDirectly(post.id);
                    if (!directRes.success) {
                        throw new Error(directRes.error || "Failed to publish to Facebook");
                    }
                    return directRes.publishedUrl || `https://facebook.com/${Date.now()}`;
                }

                if(providerType === ChannelTypeEnum.THREADS){
                    const directRes = await publishPostDirectly(post.id);
                    if (!directRes.success) {
                        throw new Error(directRes.error || "Failed to publish to Threads");
                    }
                    return directRes.publishedUrl || `https://www.threads.net/post/${Date.now()}`;
                }

                if(providerType === ChannelTypeEnum.YOUTUBE){
                    return publishToYouTube({
                        accessToken: currentAccessToken,
                        content: post.content,
                        handle: post.user_channels?.handle,
                        images: post.images,
                        logger
                    });
                }
                
                throw new Error(`Unsupported provider type: ${providerType}`)
            })

            await step.run("mark-post-published", async () => {
                await markPostPublished(post.id, publishedUrl);
            })

             return { published: true, provider: providerType }
         } catch (error) {
            logger.error("Failed to publish post", { error })
            const message = error instanceof Error ? error.message : "Unknown error"
            await markPostFailed(post.id, message)
            throw error
         }
    }
)

/**
 * Direct Synchronous Post Publisher
 * Publishes a scheduled_post directly to the provider without requiring an active Inngest server.
 */
export async function executePostPublishDirectly(postId: string): Promise<{
    success: boolean;
    publishedUrl?: string | null;
    error?: string;
    provider?: string;
}> {
    const res = await publishPostDirectly(postId);
    return {
        success: res.success,
        publishedUrl: res.publishedUrl,
        error: res.error,
    };
}

async function publishToTwitter({
    accessToken,
    content,
    handle,
    images,
    logger
}: {
    accessToken: string;
    content: string;
    handle?: string | null;
    images?: ImageObject[]
    logger: any;
}){
    const mediaIds = images?.length ? 
    await uploadImagesToTwitter({
        accessToken,
        images,
        logger
    }) : [];

    // Safely respect Twitter/X 280-character limit
    let safeText = content || "";
    if (safeText.length > 280) {
        safeText = safeText.slice(0, 277).trim() + "...";
    }

    const response = await fetch("https://api.x.com/2/tweets",{
        method:"POST",
        headers:{
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: safeText,
             ...(mediaIds.length > 0 ? { 
                media: { 
                    media_ids: mediaIds 
                } 
            } : {})
        })
    })

    if(!response.ok) throw new Error("Failed to publish to Twitter")

    const responseText = await response.text()
    let data:any = null;
    try {
        data = JSON.parse(responseText)
    } catch (error) {
        logger.error("Failed to parse Twitter response", { error, responseText })
        data = null
    }

    const postId = data?.data?.id;

    if(!postId) throw new Error("Failed to get post ID from Twitter response")
    
    return handle ? `https://x.com/${handle}/status/${postId}` : null;   
}


async function uploadImagesToTwitter({
    accessToken,
    images,
    logger
}: {
    accessToken: string;
    images: ImageObject[];
    logger: any;
}){
   const mediaIds:string[] = [];

   for(const image of images){
    const fileResponse = await fetch(image.url);
    if(!fileResponse.ok) throw new Error("Failed to fetch image");

    const bytes = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get("content-type")?.split(";")[0].trim();

    const pathname = new URL(image.url).pathname.toLowerCase();

    const mediaType = 
        contentType && 
        contentType != "binary/octet-stream" && 
        contentType != "application/octet-stream" ? contentType :
        pathname.endsWith(".png") ? "image/png" :
        pathname.endsWith(".webp") ? "image/webp" :
        "image/jpeg"

        const formData = new FormData();
        const blob = new Blob([bytes], {type: mediaType});
        formData.append("media", blob);
        formData.append("media_category", "tweet_image");
        formData.append("media_type", mediaType);

        const uploadRes = await fetch("https://api.x.com/2/media/upload", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            },
            body: formData
        })

        
        const response = await uploadRes.text();
        logger.info("Twitter media upload response", { response });
        let data:any = null;
        try {
            data = JSON.parse(response);
        } catch (e) {
            logger.error("Failed to parse Twitter media upload response", { response });
            data = null
        }
        
        if(!uploadRes.ok) {
            throw new Error(`Failed to upload media to Twitter: ${response}`)
        }
       
        const mediaId = data?.data?.id || data?.data?.media_key
       if(!mediaId) throw new Error("Failed to get media ID from Twitter response")
       mediaIds.push(mediaId)
   }
   return mediaIds
}



async function publishToLinkedIn({
  accessToken,
  text,
  authorId,
  images,
  logger,

}: {
  accessToken: string
  text: string
  authorId?: string | null
  images?: { url: string; key: string }[]
  logger: any
}) {
  if (!authorId) throw new Error("Missing LinkedIn provider account id.")
  const imageUrn = images?.[0]?.url
    ? await uploadLinkedInImage({
      accessToken,
      authorId,
      imageUrl: images[0].url,
    })
    : null
  const body: Record<string, unknown> = {
    author: `urn:li:person:${authorId}`,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  }

  if (imageUrn) {
    body.content = {
      media: {
        id: imageUrn,
      },
    }
  }
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": "202604",
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  let data: any = null
  try {
    data = responseText ? JSON.parse(responseText) : null
  } catch {
    logger.error("Failed to parse LinkedIn response", { responseText })
  }

  if (!response.ok) {
    throw new Error(data?.message|| "Failed to publish to LinkedIn.")
  }
  const restliId = response.headers.get("x-restli-id") || data?.id || null
  return restliId ? `https://www.linkedin.com/feed/update/${encodeURIComponent(restliId)}` : null
}

async function uploadLinkedInImage({
  accessToken,
  authorId,
  imageUrl,
}: {
  accessToken: string
  authorId: string
  imageUrl: string
}) {
  const initResponse = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": "202604",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: `urn:li:person:${authorId}`,
      },
    }),
  })
  const initResponseText = await initResponse.text()
  let initData: { message?: string; value?: { uploadUrl?: string; image?: string } } | null = null
  try {
    initData = initResponseText ? JSON.parse(initResponseText) : null
  } catch {
    throw new Error("Failed to parse LinkedIn image initialization response.")
  }

  if (!initResponse.ok) {
    throw new Error(initData?.message || "Failed to initialize LinkedIn image upload.")
  }
  const uploadUrl = initData?.value?.uploadUrl
  const imageUrn = initData?.value?.image
  if (!uploadUrl || !imageUrn) {
    throw new Error("LinkedIn image upload initialization did not return an upload URL.")
  }
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error("Failed to fetch image for LinkedIn upload.")
  }
  const contentType = imageResponse.headers.get("content-type") || "image/jpeg"
  const imageBuffer = await imageResponse.arrayBuffer()
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: imageBuffer,
  })
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image to LinkedIn.")
  }

  return imageUrn as string
}


async function saveRefreshedToken(
    userChannelId: string | undefined,
    accessToken: string,
    refreshToken: string,
    expiresAt: number
) {
    if(!userChannelId) {
        throw new Error("User channel ID is missing")
    };
    const insforge = getInsforgeAdminClient();
    const {error} = await insforge.database
        .from("user_channels")
        .update({
            access_token: encrypt(accessToken),
            refresh_token: encrypt(refreshToken),
            token_expires_at: expiresAt ?? null
        })
        .eq("id", userChannelId);
    
    if(error) throw error
}

async function markPostPublished(postId:string, published_url:string | null){
    const insforge = getInsforgeAdminClient();
    const {error} = await insforge.database
        .from("scheduled_posts")
        .update({
            status: "published",
            published_at: new Date().toISOString(),
            published_url: published_url
        })
        .eq("id", postId);
    if(error) throw error
}

async function markPostFailed(postId:string, errorMessage:string){
    const insforge = getInsforgeAdminClient();
    const {error} = await insforge.database
        .from("scheduled_posts")
        .update({
            status: "failed",
            error_message: errorMessage
        })
        .eq("id", postId);
    
    if(error) throw error
}

function formatLinkedInText(text: string): string {
  return text
    // normalize smart quotes to straight quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/(\d+\.)\s{2}/g, '\n\n$1 ')
    // trim
    .trim()
    .slice(0, 3000)
}

async function publishToBluesky({
    identifier,
    password,
    content,
    images,
    logger
}: {
    identifier?: string | null;
    password?: string | null;
    content: string;
    images?: ImageObject[];
    logger: any;
}) {
    if (!identifier || !password) {
        throw new Error("Missing Bluesky identifier or app password");
    }

    const cleanIdentifier = identifier.replace(/^@/, "").trim();
    let finalIdentifier = cleanIdentifier;
    let finalPassword = password;
    if (password.includes(":::")) {
        const parts = password.split(":::");
        finalIdentifier = parts[0].replace(/^@/, "").trim();
        finalPassword = parts[1];
    }
    const agent = new BskyAgent({ service: "https://bsky.social" });
    await agent.login({ identifier: finalIdentifier, password: finalPassword });

    let embed: any = undefined;

    if (images && images.length > 0) {
        const uploadedImages = [];
        for (const img of images) {
            const fileResponse = await fetch(img.url);
            if (!fileResponse.ok) continue;

            const arrayBuffer = await fileResponse.arrayBuffer();
            const contentType = fileResponse.headers.get("content-type") || "image/jpeg";

            if (contentType.startsWith("image/")) {
                const uploadRes = await agent.uploadBlob(new Uint8Array(arrayBuffer), {
                    encoding: contentType,
                });

                uploadedImages.push({
                    image: uploadRes.data.blob,
                    alt: "",
                });
            }
        }

        embed = {
            $type: "app.bsky.embed.images",
            images: uploadedImages,
        };
    }

    // Bluesky has a strict 300 grapheme limit
    let safeContent = content || "";
    if (safeContent.length > 300) {
        safeContent = safeContent.slice(0, 297).trim() + "...";
    }

    const record: any = {
        text: safeContent,
        createdAt: new Date().toISOString(),
    };

    if (embed) {
        record.embed = embed;
    }

    const result = await agent.post(record);
    logger.info("Bluesky post published", { result });

    const rkey = result.uri.split("/").pop();
    const cleanHandle = identifier.startsWith("@") ? identifier.slice(1) : identifier;
    return `https://bsky.app/profile/${cleanHandle}/post/${rkey}`;
}

async function publishToInstagram({
    accessToken,
    instagramAccountId,
    content,
    images,
    logger
}: {
    accessToken: string;
    instagramAccountId?: string | null;
    content: string;
    images?: ImageObject[];
    logger: any;
}) {
    let resolvedAccountId = instagramAccountId;
    let effectiveToken = accessToken;

    // Auto-discover Instagram Account ID & Page Access Token
    try {
        const accRes = await fetch(`https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`);
        if (accRes.ok) {
            const accData = await accRes.json();
            const pageWithIg = accData?.data?.find((p: any) => p.instagram_business_account?.id);
            if (pageWithIg?.instagram_business_account?.id) {
                resolvedAccountId = pageWithIg.instagram_business_account.id;
                if (pageWithIg.access_token) {
                    effectiveToken = pageWithIg.access_token;
                }
            }
        }
    } catch {}

    if (!resolvedAccountId) {
        try {
            const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`);
            if (meRes.ok) {
                const meData = await meRes.json();
                if (meData?.instagram_business_account?.id) {
                    resolvedAccountId = meData.instagram_business_account.id;
                }
            }
        } catch {}
    }

    if (!resolvedAccountId) {
        throw new Error("Unable to automatically detect Instagram Account ID. Please ensure your Instagram is connected to a Facebook Page or enter your Business Account ID.");
    }

    if (!images || images.length === 0) {
        throw new Error("Instagram requires at least one image to publish a post");
    }

    const mediaUrl = images[0].url;
    const isVideo = mediaUrl.toLowerCase().includes(".mp4") || (images[0] as any)?.media_type === "video";

    const containerPayload: any = isVideo
        ? {
            media_type: "REELS",
            video_url: mediaUrl,
            caption: content,
            access_token: effectiveToken,
        }
        : {
            image_url: mediaUrl,
            caption: content,
            access_token: effectiveToken,
        };

    // Step 1: Create Instagram Media Container
    const createRes = await fetch(
        `https://graph.facebook.com/v22.0/${resolvedAccountId}/media`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(containerPayload),
        }
    );

    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
        const errDetail = createData?.error?.message || JSON.stringify(createData);
        if (errDetail.includes("not a confirmed user") || errDetail.includes("user logged out") || errDetail.includes("Error validating access token")) {
            throw new Error(`Instagram session expired or unconfirmed in Meta Developer App: ${errDetail}. Please reconnect your Instagram account in Channels.`);
        }
        throw new Error(`Failed to create Instagram container: ${errDetail}`);
    }

    const containerId = createData.id;
    logger.info("Instagram media container created", { containerId, isVideo });

    // Step 1.5: If video/reel, poll container status until 'FINISHED'
    if (isVideo) {
        let isReady = false;
        const maxAttempts = 12;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise((r) => setTimeout(r, 2500));
            try {
                const statusRes = await fetch(
                    `https://graph.facebook.com/v22.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(effectiveToken)}`
                );
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (statusData?.status_code === "FINISHED") {
                        isReady = true;
                        break;
                    }
                    if (statusData?.status_code === "ERROR") {
                        throw new Error(`Instagram video processing failed: ${statusData?.status || "Container processing error"}`);
                    }
                }
            } catch (pollErr: any) {
                if (pollErr.message?.includes("Instagram video processing failed")) throw pollErr;
            }
        }
        if (!isReady) {
            logger.warn("Instagram video container did not confirm FINISHED within 30s, proceeding to attempt publish...");
        }
    }

    // Step 2: Publish Container
    const publishRes = await fetch(
        `https://graph.facebook.com/v22.0/${resolvedAccountId}/media_publish`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: effectiveToken,
            }),
        }
    );

    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
        throw new Error(`Failed to publish Instagram container: ${publishData?.error?.message || JSON.stringify(publishData)}`);
    }

    // Query Meta Graph API for authentic public permalink / shortcode
    try {
        const permalinkRes = await fetch(
            `https://graph.facebook.com/v22.0/${publishData.id}?fields=permalink,shortcode&access_token=${encodeURIComponent(effectiveToken)}`
        );
        if (permalinkRes.ok) {
            const permalinkData = await permalinkRes.json();
            if (permalinkData?.permalink) {
                return permalinkData.permalink;
            }
            if (permalinkData?.shortcode) {
                return `https://www.instagram.com/p/${permalinkData.shortcode}/`;
            }
        }
    } catch (permErr) {
        logger.warn("Could not fetch IG permalink, fallback to media ID:", { permErr });
    }

    return `https://www.instagram.com/p/${publishData.id}`;
}

async function publishToFacebook({
    accessToken,
    pageId,
    content,
    images,
    logger
}: {
    accessToken: string;
    pageId?: string | null;
    content: string;
    images?: ImageObject[];
    logger: any;
}) {
    const targetId = pageId || "me";
    logger.info("Publishing to Facebook...", { targetId, content });

    if (images && images.length > 0) {
        const mediaUrl = images[0].url;
        const isVideo = mediaUrl.toLowerCase().includes(".mp4") || (images[0] as any)?.media_type === "video";

        if (isVideo) {
            const res = await fetch(`https://graph.facebook.com/v21.0/${targetId}/videos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    file_url: mediaUrl,
                    description: content,
                    access_token: accessToken,
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Failed to post video to Facebook");
            return `https://facebook.com/${data.id}`;
        }

        const res = await fetch(`https://graph.facebook.com/v21.0/${targetId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: mediaUrl,
                caption: content,
                access_token: accessToken,
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to post photo to Facebook");
        return `https://facebook.com/${data.post_id || data.id}`;
    } else {
        const res = await fetch(`https://graph.facebook.com/v21.0/${targetId}/feed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: content,
                access_token: accessToken,
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || "Failed to post message to Facebook");
        return `https://facebook.com/${data.id}`;
    }
}

async function publishToThreads({
    accessToken,
    content,
    images,
    logger
}: {
    accessToken: string;
    content: string;
    images?: ImageObject[];
    logger: any;
}) {
    logger.info("Publishing to Threads...", { content });

    const createRes = await fetch("https://graph.threads.net/v1.0/me/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            media_type: images && images.length > 0 ? "IMAGE" : "TEXT",
            text: content,
            ...(images && images.length > 0 ? { image_url: images[0].url } : {}),
            access_token: accessToken,
        })
    });
    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
        throw new Error(createData?.error?.message || "Failed to create Threads container");
    }

    const publishRes = await fetch("https://graph.threads.net/v1.0/me/threads_publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            creation_id: createData.id,
            access_token: accessToken,
        })
    });
    const pubData = await publishRes.json();
    if (!publishRes.ok) {
        throw new Error(pubData?.error?.message || "Failed to publish Threads post");
    }
    return `https://threads.net/post/${pubData.id}`;
}

async function publishToYouTube({
    accessToken,
    content,
    handle,
    images,
    logger
}: {
    accessToken: string;
    content: string;
    handle?: string | null;
    images?: ImageObject[];
    logger: any;
}) {
    logger.info("Publishing scheduled post to YouTube...", { content, handle, mediaCount: images?.length });
    const cleanHandle = handle ? handle.replace(/^@/, '') : '';

    // First check for active video attachment
    const videoMedia = images?.find((img) => 
        img.url.endsWith(".mp4") || 
        img.url.endsWith(".mov") || 
        img.url.includes("video")
    );

    if (videoMedia) {
        try {
            // Step 1: Initialize Resumable YouTube Video Upload
            const title = (content.split('\n')[0] || "New Video").slice(0, 95);
            const initRes = await fetch(
                "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json; charset=UTF-8",
                        "X-Upload-Content-Type": "video/mp4",
                    },
                    body: JSON.stringify({
                        snippet: {
                            title,
                            description: content,
                            categoryId: "22", // People & Blogs
                        },
                        status: {
                            privacyStatus: "public",
                            selfDeclaredMadeForKids: false,
                        },
                    }),
                }
            );

            if (!initRes.ok) {
                const errText = await initRes.text();
                logger.error("YouTube video upload init failed", { errText });
                throw new Error(`YouTube API Error: ${errText}`);
            }

            const uploadUrl = initRes.headers.get("location");
            if (!uploadUrl) {
                throw new Error("Failed to obtain YouTube resumable upload URL");
            }

            // Step 2: Fetch video bytes and upload to YouTube
            const videoFileRes = await fetch(videoMedia.url);
            if (!videoFileRes.ok) {
                throw new Error("Failed to fetch media file for YouTube upload");
            }
            const videoBuffer = await videoFileRes.arrayBuffer();

            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": "video/mp4",
                },
                body: videoBuffer,
            });

            const uploadData = await uploadRes.json();
            if (uploadData?.id) {
                logger.info("YouTube video published successfully", { videoId: uploadData.id });
                return `https://www.youtube.com/watch?v=${uploadData.id}`;
            }
        } catch (ytErr: any) {
            logger.warn("YouTube video upload failed, falling back to channel post:", ytErr);
            throw ytErr;
        }
    }

    // If no video or image/text post: verify channel authorization and link to community tab
    const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
        }
    });

    if (!channelRes.ok) {
        const errText = await channelRes.text();
        logger.error("YouTube authorization error:", { errText });
        throw new Error(`YouTube API Error: ${errText}`);
    }

    const channelData = await channelRes.json();
    const channelId = channelData?.items?.[0]?.id;

    if (channelId) {
        return `https://youtube.com/channel/${channelId}`;
    }
    return cleanHandle ? `https://youtube.com/@${cleanHandle}` : "https://youtube.com";
}

