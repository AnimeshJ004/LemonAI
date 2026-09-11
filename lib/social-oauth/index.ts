import { ChannelTypeEnum } from "@/constants/channels";
import { OAuthProvider, OAuthTokenResponse } from "./types";

const DEFAULT_PROVIDER_CONFIGS: Record<ChannelTypeEnum, {
  authUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string[];
}> = {
  [ChannelTypeEnum.TWITTER]: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    profileUrl: "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username",
    scope: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  },
  [ChannelTypeEnum.LINKEDIN]: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl: "https://api.linkedin.com/v2/userinfo",
    scope: ["openid", "profile", "email", "w_member_social"],
  },
  [ChannelTypeEnum.FACEBOOK]: {
    authUrl: "https://www.facebook.com/v22.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v22.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/v22.0/me?fields=id,name,picture",
    scope: [
      "public_profile",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_read_user_content",      // Required: read Page published posts and user comments
    ],
  },
  [ChannelTypeEnum.INSTAGRAM]: {
    authUrl: "https://www.facebook.com/v22.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v22.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/v22.0/me?fields=id,name,picture",
    scope: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",   // Required: post replies to comments
      "instagram_manage_messages",   // Required: send private DMs
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_read_user_content",     // Required: read Page published posts and user comments
    ],
  },
  [ChannelTypeEnum.YOUTUBE]: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scope: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
  },
  [ChannelTypeEnum.THREADS]: {
    authUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    profileUrl: "https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url",
    scope: ["threads_basic", "threads_content_publish"],
  },
  [ChannelTypeEnum.BLUESKY]: {
    authUrl: "https://bsky.social/xrpc/com.atproto.server.createSession",
    tokenUrl: "https://bsky.social/xrpc/com.atproto.server.refreshSession",
    profileUrl: "https://bsky.social/xrpc/com.atproto.server.getSession",
    scope: [],
  },
  [ChannelTypeEnum.TIKTOK]: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktok.com/v2/oauth/token/",
    profileUrl: "https://open.tiktok.com/v2/user/info/",
    scope: ["user.info.basic", "video.upload", "video.publish"],
  },
};

function getConfig(type: ChannelTypeEnum) {
  const defaults = DEFAULT_PROVIDER_CONFIGS[type];
  const isMetaChannel = type === ChannelTypeEnum.INSTAGRAM || type === ChannelTypeEnum.FACEBOOK;

  // Unified Meta Credentials: One App ID and Secret for Facebook & Instagram
  const metaClientId = process.env.META_CLIENT_ID?.replace(/^["']|["']$/g, "").trim() || 
                       process.env.META_APP_ID?.replace(/^["']|["']$/g, "").trim() || "";
  const metaClientSecret = process.env.META_CLIENT_SECRET?.replace(/^["']|["']$/g, "").trim() || 
                            process.env.META_APP_SECRET?.replace(/^["']|["']$/g, "").trim() || "";

  // Threads API requires its own dedicated Threads App ID & App Secret from Meta for Developers (under Use Cases -> Threads)
  // It CANNOT use the main Facebook App ID (META_CLIENT_ID), as Meta will reject it with error 4476002
  const threadsClientId = process.env.THREADS_APP_ID?.replace(/^["']|["']$/g, "").trim() ||
                          process.env.THREADS_CLIENT_ID?.replace(/^["']|["']$/g, "").trim() ||
                          process.env.NEXT_PUBLIC_THREADS_APP_ID?.replace(/^["']|["']$/g, "").trim() || "";
  const threadsClientSecret = process.env.THREADS_APP_SECRET?.replace(/^["']|["']$/g, "").trim() ||
                              process.env.THREADS_CLIENT_SECRET?.replace(/^["']|["']$/g, "").trim() || "";

  let clientId = "";
  let clientSecret = "";

  if (type === ChannelTypeEnum.THREADS) {
    clientId = threadsClientId;
    clientSecret = threadsClientSecret;
  } else {
    clientId = process.env[`${type}_CLIENT_ID`]?.replace(/^["']|["']$/g, "").trim() || (isMetaChannel ? metaClientId : "");
    clientSecret = process.env[`${type}_CLIENT_SECRET`]?.replace(/^["']|["']$/g, "").trim() || (isMetaChannel ? metaClientSecret : "");
  }

  const authUrl = process.env[`${type}_AUTH_URL`] || defaults?.authUrl || "";
  const tokenUrl = process.env[`${type}_TOKEN_URL`] || defaults?.tokenUrl || "";
  const profileUrl = process.env[`${type}_PROFILE_URL`] || defaults?.profileUrl || "";
  const rawScopes = process.env[`${type}_SCOPES`];
  const scope = rawScopes
    ? rawScopes.split(",").map((s) => s.trim()).filter(Boolean)
    : defaults?.scope || [];

  return {
    authUrl,
    tokenUrl,
    profileUrl,
    clientId,
    clientSecret,
    scope,
  };
}



async function requestToken(
    type: ChannelTypeEnum,
    body: URLSearchParams,
) {
  const config = getConfig(type);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (type === ChannelTypeEnum.TWITTER && config.clientSecret) {
    const auth_header = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${auth_header}`;
  }

  let response: Response;
  const isMeta = type === ChannelTypeEnum.FACEBOOK || type === ChannelTypeEnum.INSTAGRAM;

  // Meta Graph API official spec recommends GET request for /oauth/access_token
  if (isMeta) {
    try {
      const getUrl = `${config.tokenUrl}?${body.toString()}`;
      response = await fetch(getUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      // Fallback to POST if GET fails
      if (!response.ok) {
        const postRes = await fetch(config.tokenUrl, {
          method: "POST",
          headers,
          body,
        });
        if (postRes.ok) {
          response = postRes;
        }
      }
    } catch {
      response = await fetch(config.tokenUrl, {
        method: "POST",
        headers,
        body,
      });
    }
  } else {
    response = await fetch(config.tokenUrl, {
      method: "POST",
      headers,
      body,
    });
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === "string" ? data?.error : null) ||
      JSON.stringify(data?.error || data) ||
      `Token exchange failed: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return data;
}

function createProvider(type: ChannelTypeEnum, opts: { pkce?: boolean } = {}): OAuthProvider {
  return {
    type,
    getAuthorizationUrl: ({ state, redirectUri, codeChallenge, codeChallengeMethod }) => {
      const config = getConfig(type);
      const isMeta = type === ChannelTypeEnum.FACEBOOK || type === ChannelTypeEnum.INSTAGRAM;
      const isCommaScope = isMeta || type === ChannelTypeEnum.THREADS;
      const scopeStr = isCommaScope ? config.scope.join(',') : config.scope.join(' ');
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopeStr,
        state,
      });

      // Threads OAuth: pass both client_id and app_id for full compatibility with Meta's Threads auth endpoints
      if (type === ChannelTypeEnum.THREADS) {
        params.set('app_id', config.clientId);
      }

      if (opts.pkce && codeChallenge && codeChallengeMethod) {
        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', codeChallengeMethod);
      }

      // Meta OAuth: force re-request so user is prompted to select/grant their Facebook Pages
      if (isMeta) {
        params.append('auth_type', 'rerequest');
      }

      // YouTube requires offline access to issue a refresh token
      if (type === ChannelTypeEnum.YOUTUBE) {
        params.append('access_type', 'offline');
        params.append('prompt', 'consent');
      }

      // TikTok v2 OAuth requires client_key in auth query
      if (type === ChannelTypeEnum.TIKTOK) {
        params.append('client_key', config.clientId);
      }

      return `${config.authUrl}?${params.toString()}`;
    },
    exchangeCodeForToken: async ({ code, redirectUri, codeVerifier }): Promise<OAuthTokenResponse> => {
      const config = getConfig(type);
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
      });

      if (!opts.pkce) {
        params.append('client_secret', config.clientSecret);
      }
      if (codeVerifier) {
        params.append('code_verifier', codeVerifier);
      }
      // TikTok v2 requires client_key
      if (type === ChannelTypeEnum.TIKTOK) {
        params.append('client_key', config.clientId);
      }

      const data = await requestToken(type, params);

      let finalAccessToken = data.access_token;
      let finalExpiresIn = Number(data.expires_in);

      // Meta (Facebook & Instagram): exchange short-lived user token (1-2 hr) for long-lived user token (60 days)
      if ((type === ChannelTypeEnum.FACEBOOK || type === ChannelTypeEnum.INSTAGRAM) && finalAccessToken && config.clientSecret) {
        try {
          const exchangeUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(config.clientId)}&client_secret=${encodeURIComponent(config.clientSecret)}&fb_exchange_token=${encodeURIComponent(finalAccessToken)}`;
          const exchangeRes = await fetch(exchangeUrl);
          if (exchangeRes.ok) {
            const exchangeData = await exchangeRes.json();
            if (exchangeData?.access_token) {
              finalAccessToken = exchangeData.access_token;
              if (exchangeData.expires_in) {
                finalExpiresIn = Number(exchangeData.expires_in);
              }
            }
          }
        } catch (exchangeErr) {
          console.warn(`[${type} OAuth] Notice during long-lived token exchange:`, exchangeErr);
        }
      }

      // Threads: exchange short-lived user token for long-lived user token (60 days)
      if (type === ChannelTypeEnum.THREADS && finalAccessToken && config.clientSecret) {
        try {
          const exchangeUrl = `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(config.clientSecret)}&access_token=${encodeURIComponent(finalAccessToken)}`;
          const exchangeRes = await fetch(exchangeUrl);
          if (exchangeRes.ok) {
            const exchangeData = await exchangeRes.json();
            if (exchangeData?.access_token) {
              finalAccessToken = exchangeData.access_token;
              if (exchangeData.expires_in) {
                finalExpiresIn = Number(exchangeData.expires_in);
              }
            }
          }
        } catch (exchangeErr) {
          console.warn(`[Threads OAuth] Notice during long-lived token exchange:`, exchangeErr);
        }
      }

      const expiresAt = finalExpiresIn > 0 ? new Date(Date.now() + finalExpiresIn * 1000).toISOString() : null;

      return {
        accessToken: finalAccessToken,
        refreshToken: data.refresh_token ?? null,
        expiresAt,
      };
    },
    refreshToken: async ({ refreshToken, redirectUri }) => {
      const config = getConfig(type);

      // Threads: refresh long-lived access token via dedicated endpoint
      if (type === ChannelTypeEnum.THREADS && refreshToken) {
        try {
          const refreshUrl = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(refreshToken)}`;
          const refreshRes = await fetch(refreshUrl);
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const sec = Number(refreshData?.expires_in);
            return {
              accessToken: refreshData.access_token,
              refreshToken: refreshData.access_token,
              expiresAt: sec > 0 ? new Date(Date.now() + sec * 1000).toISOString() : null,
            };
          }
        } catch (refreshErr) {
          console.warn(`[Threads OAuth] Notice during token refresh:`, refreshErr);
        }
      }

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
      });

      if (config.clientSecret) {
        params.append('client_secret', config.clientSecret);
      }
      if (redirectUri) {
        params.append('redirect_uri', redirectUri);
      }
      if (type === ChannelTypeEnum.TIKTOK) {
        params.append('client_key', config.clientId);
      }

      const data = await requestToken(type, params);

      const seconds = Number(data.expires_in);
      const expiresAt = seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt,
      };
    },
    getProfile: async ({ accessToken }) => {
      const config = getConfig(type);

      // Resolve linked Instagram Business Account from user's Facebook Pages
      if (type === ChannelTypeEnum.INSTAGRAM) {
        try {
          const igRes = await fetch(`https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            }
          });
          if (igRes.ok) {
            const igData = await igRes.json();
            const pages = igData?.data || [];
            const pageWithIg = pages.find((p: any) => p.instagram_business_account?.id);
            if (pageWithIg?.instagram_business_account) {
              const ig = pageWithIg.instagram_business_account;
              return {
                providerAccountId: ig.id,
                handle: ig.username ? `@${ig.username.replace(/^@/, '')}` : null,
                profileImage: ig.profile_picture_url || null,
                pageAccessToken: pageWithIg.access_token || accessToken,
              };
            }
          }
        } catch (igErr) {
          console.warn("[Instagram OAuth] Notice checking me/accounts:", igErr);
        }
      }

      // Resolve user's primary Facebook Page and Page Access Token for Facebook
      if (type === ChannelTypeEnum.FACEBOOK) {
        let pageErrorDetails = "";
        try {
          const fbRes = await fetch(`https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,picture{url}&access_token=${encodeURIComponent(accessToken)}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            }
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            const pages = fbData?.data || [];
            const primaryPage = pages[0];
            if (primaryPage) {
              return {
                providerAccountId: primaryPage.id,
                handle: primaryPage.name || null,
                profileImage: primaryPage.picture?.data?.url || null,
                pageAccessToken: primaryPage.access_token || accessToken,
              };
            }
          } else {
            const errData = await fbRes.json().catch(() => ({}));
            pageErrorDetails = errData?.error?.message ? ` (${errData.error.message})` : "";
          }
        } catch (fbErr: any) {
          console.warn("[Facebook OAuth] Notice checking me/accounts:", fbErr);
          pageErrorDetails = fbErr?.message ? ` (${fbErr.message})` : "";
        }

        // Meta Graph API strictly requires a Facebook Page to schedule and publish posts.
        // If no page is returned, we must not fall back to the personal profile ID as it will always fail when publishing.
        throw new Error(
          `No Facebook Page found on this account${pageErrorDetails}. Meta requires a Facebook Page to publish posts (personal profiles cannot be published to via API). Please create a Facebook Page at https://facebook.com/pages/create, grant permission to it in the login popup, and reconnect.`
        );
      }

      // General fallback to profileUrl
      const profileUrlWithToken = (type === ChannelTypeEnum.INSTAGRAM)
        ? `${config.profileUrl}&access_token=${encodeURIComponent(accessToken)}`
        : config.profileUrl;

      const response = await fetch(profileUrlWithToken, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        }
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Failed to fetch profile from ${type}: ${response.status} ${errText || response.statusText}`);
      }

      const data = await response.json();
      const profileData = data?.data ?? data?.user ?? data;
      const providerAccountId = profileData?.id ?? profileData?.sub ?? profileData?.user_id ?? null;
      const handle = profileData?.username ?? profileData?.screen_name ?? profileData?.handle ?? profileData?.name ?? null;
      const profileImage = profileData?.threads_profile_picture_url ?? profileData?.thread_profile_picture ?? profileData?.profile_image_url ?? profileData?.avatar_url ?? profileData?.profile_image ?? profileData?.picture?.data?.url ?? profileData?.picture?.url ?? profileData?.picture ?? null;

      return {
        providerAccountId,
        handle,
        profileImage,
        pageAccessToken: accessToken,
      };
    },
  };
}


const PROVIDERS: Record<ChannelTypeEnum, any> = {
    [ChannelTypeEnum.TWITTER]: createProvider(ChannelTypeEnum.TWITTER,{ pkce: true }),
    [ChannelTypeEnum.LINKEDIN]: createProvider(ChannelTypeEnum.LINKEDIN),
    [ChannelTypeEnum.INSTAGRAM]: createProvider(ChannelTypeEnum.INSTAGRAM),
    [ChannelTypeEnum.FACEBOOK]: createProvider(ChannelTypeEnum.FACEBOOK),
    [ChannelTypeEnum.THREADS]: createProvider(ChannelTypeEnum.THREADS),
    [ChannelTypeEnum.BLUESKY]: createProvider(ChannelTypeEnum.BLUESKY),
    [ChannelTypeEnum.YOUTUBE]: createProvider(ChannelTypeEnum.YOUTUBE),
    [ChannelTypeEnum.TIKTOK]: createProvider(ChannelTypeEnum.TIKTOK),
}

export function isProviderConfigured(type: ChannelTypeEnum): boolean {
  try {
    const config = getConfig(type);
    const clientId = config.clientId;
    if (!clientId) return false;
    const lower = clientId.toLowerCase();
    if (
      lower.includes("your-") ||
      lower.includes("placeholder") ||
      lower.includes("todo") ||
      lower.length < 3
    ) {
      return false;
    }
    return Boolean(config.authUrl && config.tokenUrl && config.clientId);
  } catch {
    return false;
  }
}

export function getOAuthProvider(type:ChannelTypeEnum) {
   return PROVIDERS[type];
}

export async function refreshOauthToken(
  type:ChannelTypeEnum,
  refreshToken:string,
  redirectUri:string,
){
  console.log("refreshing token", type, refreshToken, redirectUri)
  const provider = getOAuthProvider(type);
  if(!provider.refreshToken){
    throw new Error('Refresh token not supported for this provider');
  }
  const result = await provider.refreshToken({refreshToken, redirectUri});
  return result;
}
