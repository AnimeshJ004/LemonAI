import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { inngest } from "../client";
import { ImageObject, PostType } from "@/types/post.type";
import { decrypt, encrypt } from "@/lib/encryption";
import { refreshOauthToken } from "@/lib/social-oauth";
import { ChannelTypeEnum } from "@/constants/channels";
import { BskyAgent } from "@atproto/api";


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
        idempotency: "event.data.postId",
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

       if (post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now()) {
        await step.sleepUntil("wait-for-scheduled-time", post.scheduled_at);
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
            logger.error("Missing provider type or access token", { providerType, accessToken })
            return { skipped: true, reason: "missing_provider_or_token" }
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

    const response = await fetch("https://api.x.com/2/tweets",{
        method:"POST",
        headers:{
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: content,
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
    const agent = new BskyAgent({ service: "https://bsky.social" });
    await agent.login({ identifier: cleanIdentifier, password });

    let embed: any = undefined;

    if (images && images.length > 0) {
        const uploadedImages = [];
        for (const img of images) {
            const fileResponse = await fetch(img.url);
            if (!fileResponse.ok) throw new Error("Failed to fetch image for Bluesky upload");

            const arrayBuffer = await fileResponse.arrayBuffer();
            const contentType = fileResponse.headers.get("content-type") || "image/jpeg";

            const uploadRes = await agent.uploadBlob(new Uint8Array(arrayBuffer), {
                encoding: contentType,
            });

            uploadedImages.push({
                image: uploadRes.data.blob,
                alt: "",
            });
        }

        embed = {
            $type: "app.bsky.embed.images",
            images: uploadedImages,
        };
    }

    const record: any = {
        text: content,
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
    if (!instagramAccountId) {
        throw new Error("Missing Instagram Business Account ID");
    }

    if (!images || images.length === 0) {
        throw new Error("Instagram requires at least one image to publish a post");
    }

    const imageUrl = images[0].url;

    // Step 1: Create Instagram Media Container
    const createRes = await fetch(
        `https://graph.facebook.com/v21.0/${instagramAccountId}/media`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image_url: imageUrl,
                caption: content,
                access_token: accessToken,
            }),
        }
    );

    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
        throw new Error(`Failed to create Instagram container: ${createData?.error?.message || JSON.stringify(createData)}`);
    }

    const containerId = createData.id;
    logger.info("Instagram media container created", { containerId });

    // Step 2: Publish Container
    const publishRes = await fetch(
        `https://graph.facebook.com/v21.0/${instagramAccountId}/media_publish`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: accessToken,
            }),
        }
    );

    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
        throw new Error(`Failed to publish Instagram container: ${publishData?.error?.message || JSON.stringify(publishData)}`);
    }

    return `https://www.instagram.com/p/${publishData.id}`;
}
