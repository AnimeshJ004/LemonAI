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
    profileUrl: "https://api.twitter.com/2/users/me",
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
    scope: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "publish_video"],
  },
  [ChannelTypeEnum.INSTAGRAM]: {
    authUrl: "https://api.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    profileUrl: "https://graph.instagram.com/me?fields=id,username",
    scope: ["instagram_basic", "instagram_content_publish"],
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
  const clientId = process.env[`${type}_CLIENT_ID`]?.replace(/^["']|["']$/g, "").trim() || "";
  const clientSecret = process.env[`${type}_CLIENT_SECRET`]?.replace(/^["']|["']$/g, "").trim() || "";
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
    type:ChannelTypeEnum,
    body: URLSearchParams,
){
    const config = getConfig(type);
const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  }

  if(type === ChannelTypeEnum.TWITTER && config.clientSecret){
     const auth_header = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
     headers.Authorization = `Basic ${auth_header}`
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body,
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || `Token exchange failed: ${response.statusText}`)
  }

  return data
}


function createProvider(type:ChannelTypeEnum,opts: { pkce?: boolean} = {}): OAuthProvider {
   return {
    type,
    getAuthorizationUrl: ({state, redirectUri, codeChallenge, codeChallengeMethod}) => {
       const config = getConfig(type)
       // Build authorization URL with query parameters
       const params = new URLSearchParams({
         client_id: config.clientId,
         redirect_uri: redirectUri,
         response_type: 'code',
         scope: config.scope.join(' '),
         state,
       })
       if (opts.pkce && codeChallenge && codeChallengeMethod) {
         params.append('code_challenge', codeChallenge)
         params.append('code_challenge_method', codeChallengeMethod)
       }
       return `${config.authUrl}?${params.toString()}`
    },
    exchangeCodeForToken: async ({ code, redirectUri, codeVerifier }):Promise<OAuthTokenResponse> => {
       const params = new URLSearchParams({
         grant_type: 'authorization_code',
         code,
         redirect_uri: redirectUri,
         client_id: getConfig(type).clientId,
       })

       if(!opts.pkce){
         params.append('client_secret', getConfig(type).clientSecret)
       }
       if(codeVerifier){
         params.append('code_verifier', codeVerifier)
       }

       const data = await requestToken(type, params)

       const seconds = Number(data.expires_in)
       const expiresAt = seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString(): null

       return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt,
       }
      
    },
    refreshToken: async ({ refreshToken, redirectUri }) => {
      const config = getConfig(type);
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
      })

      if(config.clientSecret){
        params.append('client_secret', config.clientSecret)
      }
      if(redirectUri){
        params.append('redirect_uri', redirectUri)
      }

      const data = await requestToken(type, params)
      
      const seconds = Number(data.expires_in)
      const expiresAt = seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString(): null
      
      return {
       accessToken: data.access_token,
       refreshToken: data.refresh_token ?? null,
       expiresAt,
      }
    },
    getProfile: async ({ accessToken }) => {
      const config = getConfig(type);
      const response = await fetch(config.profileUrl,{
        headers:{
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
        }
      })
      if(!response.ok){
        throw new Error('Failed to fetch profile')
      }
      const data = await response.json()

      const profileData = data?.data ?? data?.user ?? data
      const providerAccountId = profileData?.id ?? profileData?.sub ?? profileData?.user_id ?? null;
      
      const handle = profileData?.username ?? profileData?.screen_name ?? profileData?.handle  ?? profileData?.name ?? null;

      const profileImage = profileData?.thread_profile_picture ?? profileData?.profile_image_url ?? profileData?.avatar_url ?? profileData?.profile_image ?? profileData?.picture?.data?.url ?? profileData?.picture?.url ?? profileData?.picture ?? null

      console.log(providerAccountId, handle, "providerAccountId")
     
      return {
        providerAccountId,
        handle,
        profileImage,
      }
    },
   }
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
    const clientId = process.env[`${type}_CLIENT_ID`]?.replace(/^["']|["']$/g, "").trim();
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
    const config = getConfig(type);
    return Boolean(config.authUrl && config.tokenUrl);
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
