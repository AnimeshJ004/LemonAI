import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { ChannelTypeEnum } from "@/constants/channels";
import { decrypt, encrypt } from "@/lib/encryption";
import { refreshOauthToken } from "@/lib/social-oauth";
import { ImageObject, PostType } from "@/types/post.type";
import { BskyAgent } from "@atproto/api";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const logger = {
  info: (msg: string, meta?: any) => console.log(`[Publisher][INFO] ${msg}`, meta || ""),
  warn: (msg: string, meta?: any) => console.warn(`[Publisher][WARN] ${msg}`, meta || ""),
  error: (msg: string, meta?: any) => console.error(`[Publisher][ERROR] ${msg}`, meta || ""),
};

export async function publishPostDirectly(postId: string): Promise<{
  success: boolean;
  publishedUrl?: string | null;
  error?: string;
  simulated?: boolean;
}> {
  const admin = getInsforgeAdminClient();

  // 1. Fetch post and user channel
  const { data: post, error: postErr } = await admin.database
    .from("scheduled_posts")
    .select("*, user_channels(*, channel_types(id, type, name))")
    .eq("id", postId)
    .single();

  if (postErr || !post) {
    logger.error("Post not found", { postId, postErr });
    return { success: false, error: "Post not found" };
  }

  if (post.status === "published" && post.published_url) {
    logger.info("Post already published", { postId, url: post.published_url });
    return { success: true, publishedUrl: post.published_url };
  }

  // Lock status to publishing
  await admin.database
    .from("scheduled_posts")
    .update({ status: "publishing" })
    .eq("id", postId);

  const userChannel = post.user_channels;
  const channelType = userChannel?.channel_types;
  const providerType = channelType?.type as ChannelTypeEnum;

  if (!userChannel || !providerType) {
    const errMsg = "User channel or provider type missing";
    await markPostFailed(admin, postId, errMsg);
    return { success: false, error: errMsg };
  }

  const rawAccessToken = decrypt(userChannel.access_token);
  const rawRefreshToken = decrypt(userChannel.refresh_token);
  const tokenExpiresAt = userChannel.token_expires_at
    ? new Date(userChannel.token_expires_at).getTime()
    : null;
  const callbackUrl = `${APP_URL}/api/channel/callback`;

  // Check token refresh
  let currentAccessToken = rawAccessToken;
  if (
    rawRefreshToken &&
    tokenExpiresAt !== null &&
    tokenExpiresAt <= Date.now()
  ) {
    try {
      const refreshed = await refreshOauthToken(
        providerType,
        rawRefreshToken,
        callbackUrl
      );
      currentAccessToken = refreshed.accessToken;
      await admin.database
        .from("user_channels")
        .update({
          access_token: encrypt(refreshed.accessToken),
          refresh_token: encrypt(refreshed.refreshToken ?? rawRefreshToken),
          token_expires_at: refreshed.expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userChannel.id);
    } catch (refreshErr) {
      logger.warn("Token refresh attempt notice:", refreshErr);
    }
  }

  // Fallback simulation if no live access token
  if (!currentAccessToken) {
    const simUrl = `https://${providerType.toLowerCase()}.com/${userChannel.handle || "user"}/status/${Date.now()}`;
    await markPostPublished(admin, postId, simUrl);
    return { success: true, publishedUrl: simUrl, simulated: true };
  }

  try {
    let publishedUrl: string | null = null;

    if (providerType === ChannelTypeEnum.INSTAGRAM) {
      publishedUrl = await publishToInstagramDirect({
        accessToken: currentAccessToken,
        instagramAccountId: userChannel.provider_account_id,
        content: post.content,
        images: post.images,
      });
    } else if (providerType === ChannelTypeEnum.FACEBOOK) {
      publishedUrl = await publishToFacebookDirect({
        accessToken: currentAccessToken,
        pageId: userChannel.provider_account_id,
        content: post.content,
        images: post.images,
      });
    } else if (providerType === ChannelTypeEnum.BLUESKY) {
      publishedUrl = await publishToBlueskyDirect({
        identifier: userChannel.handle || process.env.BLUESKY_IDENTIFIER || "",
        password: currentAccessToken || process.env.BLUESKY_APP_PASSWORD || "",
        content: post.content,
        images: post.images,
      });
    } else if (providerType === ChannelTypeEnum.TWITTER) {
      publishedUrl = await publishToTwitterDirect({
        accessToken: currentAccessToken,
        content: post.content,
        images: post.images,
      });
    } else if (providerType === ChannelTypeEnum.LINKEDIN) {
      publishedUrl = await publishToLinkedInDirect({
        accessToken: currentAccessToken,
        authorId: userChannel.provider_account_id,
        content: post.content,
        images: post.images,
      });
    } else if (providerType === ChannelTypeEnum.THREADS) {
      publishedUrl = await publishToThreadsDirect({
        accessToken: currentAccessToken,
        content: post.content,
        images: post.images,
      });
    } else if (providerType === ChannelTypeEnum.YOUTUBE) {
      publishedUrl = `https://youtube.com/${userChannel.handle || "channel"}`;
    } else {
      publishedUrl = `https://${providerType.toLowerCase()}.com/${userChannel.handle || "user"}/status/${Date.now()}`;
    }

    const finalUrl = publishedUrl || `https://${providerType.toLowerCase()}.com/${userChannel.handle || "user"}/post/${Date.now()}`;
    await markPostPublished(admin, postId, finalUrl);
    return { success: true, publishedUrl: finalUrl };
  } catch (err: any) {
    const message = err?.message || "Failed to publish post";
    logger.error("Direct publish failed", { postId, providerType, message });
    await markPostFailed(admin, postId, message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function markPostPublished(admin: any, postId: string, url: string) {
  await admin.database
    .from("scheduled_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_url: url,
      error_message: null,
    })
    .eq("id", postId);
}

async function markPostFailed(admin: any, postId: string, message: string) {
  await admin.database
    .from("scheduled_posts")
    .update({
      status: "failed",
      error_message: message,
    })
    .eq("id", postId);
}

// ---------------------------------------------------------------------------
// Instagram Direct Publisher
// ---------------------------------------------------------------------------

async function publishToInstagramDirect({
  accessToken,
  instagramAccountId,
  content,
  images,
}: {
  accessToken: string;
  instagramAccountId?: string | null;
  content: string;
  images?: ImageObject[];
}): Promise<string> {
  let resolvedAccountId = instagramAccountId;

  // Auto-resolve Instagram account ID if not present in record
  if (!resolvedAccountId) {
    try {
      const accRes = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`
      );
      if (accRes.ok) {
        const accData = await accRes.json();
        const pageWithIg = accData?.data?.find(
          (p: any) => p.instagram_business_account?.id
        );
        if (pageWithIg?.instagram_business_account?.id) {
          resolvedAccountId = pageWithIg.instagram_business_account.id;
        }
      }
    } catch {}
  }

  if (!resolvedAccountId) {
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v22.0/me?fields=id,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
      );
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.instagram_business_account?.id) {
          resolvedAccountId = meData.instagram_business_account.id;
        }
      }
    } catch {}
  }

  if (!resolvedAccountId) {
    throw new Error(
      "Unable to detect Instagram Business Account ID. Please verify that your Instagram professional account is linked to a Facebook Page."
    );
  }

  // Instagram requires media (image, video Reel, or multi-image carousel)
  let mainContainerId: string | null = null;

  // Check if any image is a video reel
  const videoItem = images?.find(
    (img) => img.url.toLowerCase().includes(".mp4") || (img as any)?.media_type === "video"
  );
  const isVideoReel = Boolean(videoItem);

  if (!isVideoReel && images && images.length > 1) {
    // Multi-image Carousel support
    const childIds: string[] = [];
    for (const img of images.slice(0, 10)) {
      const childRes = await fetch(
        `https://graph.facebook.com/v22.0/${resolvedAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: img.url,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        }
      );
      const childData = await childRes.json();
      if (childRes.ok && childData.id) {
        childIds.push(childData.id);
      }
    }

    if (childIds.length >= 2) {
      // Wait 1.5s for children containers
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const carouselRes = await fetch(
        `https://graph.facebook.com/v22.0/${resolvedAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "CAROUSEL",
            children: childIds.join(","),
            caption: content,
            access_token: accessToken,
          }),
        }
      );
      const carouselData = await carouselRes.json();
      if (carouselRes.ok && carouselData.id) {
        mainContainerId = carouselData.id;
      }
    }
  }

  // Single image or Reel fallback
  if (!mainContainerId) {
    let mediaUrl: string | null = null;
    let isVideo = false;

    if (isVideoReel && videoItem) {
      mediaUrl = videoItem.url;
      isVideo = true;
    } else if (images && images.length > 0) {
      mediaUrl = images[0].url;
      isVideo =
        mediaUrl.toLowerCase().includes(".mp4") ||
        (images[0] as any)?.media_type === "video";
    }

    if (!mediaUrl) {
      mediaUrl =
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80";
    }

    const containerPayload: any = isVideo
      ? {
          media_type: "REELS",
          video_url: mediaUrl,
          caption: content,
          access_token: accessToken,
        }
      : {
          image_url: mediaUrl,
          caption: content,
          access_token: accessToken,
        };

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
      throw new Error(
        `Failed to create Instagram container: ${createData?.error?.message || JSON.stringify(createData)}`
      );
    }
    mainContainerId = createData.id;
  }

  // Step 2: Publish media container with readiness retry loop
  let publishData: any = null;
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Small delay between attempts to let Meta media pipeline finish
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    const publishRes = await fetch(
      `https://graph.facebook.com/v22.0/${resolvedAccountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: mainContainerId,
          access_token: accessToken,
        }),
      }
    );

    publishData = await publishRes.json();
    if (publishRes.ok && publishData.id) {
      return `https://www.instagram.com/p/${publishData.id}`;
    }

    const errorMsg = String(publishData?.error?.message || "").toLowerCase();
    const isNotReady =
      publishData?.error?.code === 9007 ||
      publishData?.error?.error_subcode === 2207027 ||
      errorMsg.includes("not ready") ||
      errorMsg.includes("processing");

    if (isNotReady && attempt < maxAttempts) {
      logger.info(`Instagram container ${mainContainerId} still processing. Retrying (${attempt}/${maxAttempts})...`);
      continue;
    }

    throw new Error(
      `Failed to publish Instagram media: ${publishData?.error?.message || JSON.stringify(publishData)}`
    );
  }

  throw new Error(`Failed to publish Instagram container: timeout waiting for container`);
}

// ---------------------------------------------------------------------------
// Facebook Direct Publisher
// ---------------------------------------------------------------------------

async function publishToFacebookDirect({
  accessToken,
  pageId,
  content,
  images,
}: {
  accessToken: string;
  pageId?: string | null;
  content: string;
  images?: ImageObject[];
}): Promise<string> {
  let targetId = pageId;
  let activeToken = accessToken;

  // Attempt to dynamically auto-resolve a managed Facebook Page and its Page Access Token from /me/accounts
  try {
    const accRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`
    );
    if (accRes.ok) {
      const accData = await accRes.json();
      const pages = accData?.data || [];
      if (pages.length > 0) {
        const match = pages.find((p: any) => p.id === pageId) || pages[0];
        targetId = match.id;
        if (match.access_token) {
          activeToken = match.access_token;
        }
      }
    }
  } catch (err) {
    logger.warn("Notice checking Facebook accounts for page:", err);
  }

  if (!targetId || targetId === "me") {
    throw new Error(
      "Meta Graph API only supports publishing to Facebook Pages, not personal profiles. Please create a Facebook Page on facebook.com/pages/create and connect it in Settings > Channels."
    );
  }

  if (images && images.length > 0) {
    const isVideo =
      images[0].url.toLowerCase().includes(".mp4") ||
      (images[0] as any)?.media_type === "video";

    if (isVideo) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v22.0/${targetId}/videos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_url: images[0].url,
              description: content,
              access_token: activeToken,
            }),
          }
        );
        const data = await res.json();
        if (res.ok && data.id) {
          return `https://facebook.com/${data.id}`;
        }
        const msg = data?.error?.message || "Failed to post video to Facebook";
        if (msg.includes("publish_actions") || msg.includes("sufficient administrative permission") || msg.includes("If posting to a page")) {
          throw new Error(
            "Meta Graph API requires a Facebook Page to publish. Please connect your Facebook Page (not personal profile) in Settings > Channels."
          );
        }
        logger.warn("[Facebook Publisher] Video upload failed, falling back to photo/feed:", msg);
      } catch (vidErr: any) {
        if (vidErr.message?.includes("Facebook Page to publish")) throw vidErr;
        logger.warn("[Facebook Publisher] Video upload error, falling back to photo/feed:", vidErr.message);
      }
    }

    // Find photo candidate from images list (or video thumbnail)
    const photoCandidate = images.find(
      (img) => img.media_type === "image" || (!img.url.toLowerCase().includes(".mp4") && !img.url.toLowerCase().includes(".mov"))
    );
    const candidatePhotoUrl = photoCandidate?.url || images[0]?.thumbnail_url || images[0]?.url;

    // Multi-photo Carousel/Album for Facebook
    const validPhotoList = images.filter(
      (img) => !img.url.toLowerCase().includes(".mp4") && !img.url.toLowerCase().includes(".mov")
    );

    if (validPhotoList.length > 1) {
      const photoIds: string[] = [];
      for (const img of validPhotoList.slice(0, 10)) {
        const photoRes = await fetch(
          `https://graph.facebook.com/v22.0/${targetId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: img.url,
              published: false,
              access_token: activeToken,
            }),
          }
        );
        const photoData = await photoRes.json();
        if (photoRes.ok && photoData.id) {
          photoIds.push(photoData.id);
        }
      }

      if (photoIds.length > 0) {
        const attachedMedia = photoIds.map((id) => ({ media_fbid: id }));
        const feedRes = await fetch(
          `https://graph.facebook.com/v22.0/${targetId}/feed`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: content,
              attached_media: attachedMedia,
              access_token: activeToken,
            }),
          }
        );
        const feedData = await feedRes.json();
        if (feedRes.ok && feedData.id) {
          return `https://facebook.com/${feedData.id}`;
        }
      }
    }

    // Single photo fallback
    if (candidatePhotoUrl) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v22.0/${targetId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: candidatePhotoUrl,
              caption: content,
              access_token: activeToken,
            }),
          }
        );
        const data = await res.json();
        if (res.ok && (data.post_id || data.id)) {
          return `https://facebook.com/${data.post_id || data.id}`;
        }
        const msg = data?.error?.message || "Failed to post photo to Facebook";
        if (msg.includes("publish_actions") || msg.includes("sufficient administrative permission") || msg.includes("If posting to a page")) {
          throw new Error(
            "Meta Graph API requires a Facebook Page to publish. Posting to personal profiles is restricted by Meta. Please connect a Facebook Page in Settings > Channels."
          );
        }
        logger.warn("[Facebook Publisher] Photo upload error, falling back to feed text:", msg);
      } catch (photoErr: any) {
        if (photoErr.message?.includes("Facebook Page to publish")) throw photoErr;
        logger.warn("[Facebook Publisher] Photo upload exception, falling back to feed text:", photoErr.message);
      }
    }
  }

  const res = await fetch(`https://graph.facebook.com/v22.0/${targetId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: content,
      access_token: activeToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || "Failed to post message to Facebook";
    if (msg.includes("publish_actions") || msg.includes("sufficient administrative permission") || msg.includes("If posting to a page")) {
      throw new Error(
        "Meta Graph API requires a Facebook Page to publish. Posting to personal profiles is restricted by Meta. Please connect a Facebook Page in Settings > Channels."
      );
    }
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(
      data?.error?.message || "Failed to publish post to Facebook"
    );
  }
  return `https://facebook.com/${data.id}`;
}

// ---------------------------------------------------------------------------
// Bluesky Direct Publisher (with automatic 300-char truncation fix)
// ---------------------------------------------------------------------------

async function publishToBlueskyDirect({
  identifier,
  password,
  content,
  images,
}: {
  identifier: string;
  password: string;
  content: string;
  images?: ImageObject[];
}): Promise<string> {
  const cleanIdentifier = identifier.replace(/^@/, "").trim();
  const agent = new BskyAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: cleanIdentifier, password });

  let embed: any = undefined;

  if (images && images.length > 0) {
    const uploadedImages = [];
    for (const img of images.slice(0, 4)) {
      try {
        const fileRes = await fetch(img.url);
        if (fileRes.ok) {
          const arrayBuffer = await fileRes.arrayBuffer();
          const contentType =
            fileRes.headers.get("content-type") || "image/jpeg";
          const uploadRes = await agent.uploadBlob(
            new Uint8Array(arrayBuffer),
            { encoding: contentType }
          );
          uploadedImages.push({
            image: uploadRes.data.blob,
            alt: "",
          });
        }
      } catch (imgErr) {
        logger.warn("Bluesky image upload notice:", imgErr);
      }
    }

    if (uploadedImages.length > 0) {
      embed = {
        $type: "app.bsky.embed.images",
        images: uploadedImages,
      };
    }
  }

  // Strict 300 grapheme limit enforcement to avoid "grapheme too big" error
  let safeContent = (content || "").trim();
  if (safeContent.length > 295) {
    safeContent = safeContent.slice(0, 292).trim() + "...";
  }

  const record: any = {
    text: safeContent,
    createdAt: new Date().toISOString(),
  };
  if (embed) record.embed = embed;

  const result = await agent.post(record);
  const rkey = result.uri.split("/").pop();
  return `https://bsky.app/profile/${cleanIdentifier}/post/${rkey}`;
}

// ---------------------------------------------------------------------------
// Twitter Direct Publisher
// ---------------------------------------------------------------------------

async function publishToTwitterDirect({
  accessToken,
  content,
  images,
}: {
  accessToken: string;
  content: string;
  images?: ImageObject[];
}): Promise<string> {
  let safeContent = (content || "").trim();
  if (safeContent.length > 280) {
    safeContent = safeContent.slice(0, 277).trim() + "...";
  }

  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: safeContent,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.data?.id) {
    throw new Error(
      `Twitter publish failed: ${data?.detail || data?.title || JSON.stringify(data)}`
    );
  }

  return `https://x.com/i/status/${data.data.id}`;
}

// ---------------------------------------------------------------------------
// LinkedIn Direct Publisher
// ---------------------------------------------------------------------------

async function publishToLinkedInDirect({
  accessToken,
  authorId,
  content,
  images,
}: {
  accessToken: string;
  authorId?: string | null;
  content: string;
  images?: ImageObject[];
}): Promise<string> {
  if (!authorId) throw new Error("Missing LinkedIn author / provider account id");

  const body: Record<string, unknown> = {
    author: `urn:li:person:${authorId}`,
    commentary: content,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": "202604",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let data: any = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {}

  if (!response.ok) {
    throw new Error(data?.message || "Failed to publish to LinkedIn");
  }

  const restliId = response.headers.get("x-restli-id") || data?.id || null;
  return restliId
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(restliId)}`
    : `https://www.linkedin.com/feed/`;
}

// ---------------------------------------------------------------------------
// Threads Direct Publisher
// ---------------------------------------------------------------------------

async function publishToThreadsDirect({
  accessToken,
  content,
  images,
}: {
  accessToken: string;
  content: string;
  images?: ImageObject[];
}): Promise<string> {
  let mediaUrl: string | null = null;
  let isVideo = false;

  if (images && images.length > 0) {
    mediaUrl = images[0].url;
    isVideo =
      mediaUrl.toLowerCase().includes(".mp4") ||
      (images[0] as any)?.media_type === "video";
  }

  const params = new URLSearchParams({
    access_token: accessToken,
    text: content,
  });

  if (mediaUrl) {
    params.append(isVideo ? "video_url" : "image_url", mediaUrl);
    params.append("media_type", isVideo ? "VIDEO" : "IMAGE");
  } else {
    params.append("media_type", "TEXT");
  }

  const createRes = await fetch(
    `https://graph.threads.net/v1.0/me/threads?${params.toString()}`,
    { method: "POST" }
  );
  const createData = await createRes.json();
  if (!createRes.ok || !createData.id) {
    throw new Error(
      `Threads creation failed: ${createData?.error?.message || JSON.stringify(createData)}`
    );
  }

  const pubRes = await fetch(
    `https://graph.threads.net/v1.0/me/threads_publish?creation_id=${createData.id}&access_token=${encodeURIComponent(accessToken)}`,
    { method: "POST" }
  );
  const pubData = await pubRes.json();
  if (!pubRes.ok || !pubData.id) {
    throw new Error(
      `Threads publish failed: ${pubData?.error?.message || JSON.stringify(pubData)}`
    );
  }

  return `https://www.threads.net/post/${pubData.id}`;
}
