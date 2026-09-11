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
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
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
};

function getEnvClean(key: string): string {
  return process.env[key]?.replace(/^["']|["']$/g, "").trim() || "";
}

function getConfig(type: ChannelTypeEnum) {
  const defaults = DEFAULT_PROVIDER_CONFIGS[type];
  const isMetaChannel = type === ChannelTypeEnum.INSTAGRAM || type === ChannelTypeEnum.FACEBOOK;

  // Unified Meta Credentials (Facebook & Instagram)
  const metaClientId = getEnvClean("META_CLIENT_ID") || getEnvClean("META_APP_ID") || getEnvClean("FACEBOOK_CLIENT_ID") || getEnvClean("INSTAGRAM_CLIENT_ID");
  const metaClientSecret = getEnvClean("META_CLIENT_SECRET") || getEnvClean("META_APP_SECRET") || getEnvClean("FACEBOOK_CLIENT_SECRET") || getEnvClean("INSTAGRAM_CLIENT_SECRET");

  // Threads API
  const threadsClientId = getEnvClean("THREADS_APP_ID") || getEnvClean("THREADS_CLIENT_ID") || getEnvClean("NEXT_PUBLIC_THREADS_APP_ID");
  const threadsClientSecret = getEnvClean("THREADS_APP_SECRET") || getEnvClean("THREADS_CLIENT_SECRET");

  // YouTube / Google OAuth
  const youtubeClientId = getEnvClean("YOUTUBE_CLIENT_ID") || getEnvClean("GOOGLE_CLIENT_ID") || getEnvClean("GOOGLE_OAUTH_CLIENT_ID") || getEnvClean("YOUTUBE_APP_ID");
  const youtubeClientSecret = getEnvClean("YOUTUBE_CLIENT_SECRET") || getEnvClean("GOOGLE_CLIENT_SECRET") || getEnvClean("GOOGLE_OAUTH_CLIENT_SECRET") || getEnvClean("YOUTUBE_APP_SECRET");

  // Twitter / X OAuth
  const twitterClientId = getEnvClean("TWITTER_CLIENT_ID") || getEnvClean("X_CLIENT_ID") || getEnvClean("TWITTER_API_KEY");
  const twitterClientSecret = getEnvClean("TWITTER_CLIENT_SECRET") || getEnvClean("X_CLIENT_SECRET") || getEnvClean("TWITTER_API_SECRET");

  // LinkedIn OAuth
  const linkedinClientId = getEnvClean("LINKEDIN_CLIENT_ID") || getEnvClean("LINKEDIN_OAUTH_CLIENT_ID");
  const linkedinClientSecret = getEnvClean("LINKEDIN_CLIENT_SECRET") || getEnvClean("LINKEDIN_OAUTH_CLIENT_SECRET");

  let clientId = "";
  let clientSecret = "";

  if (type === ChannelTypeEnum.THREADS) {
    clientId = threadsClientId;
    clientSecret = threadsClientSecret;
  } else if (type === ChannelTypeEnum.YOUTUBE) {
    clientId = youtubeClientId;
    clientSecret = youtubeClientSecret;
  } else if (type === ChannelTypeEnum.TWITTER) {
    clientId = twitterClientId;
    clientSecret = twitterClientSecret;
  } else if (type === ChannelTypeEnum.LINKEDIN) {
    clientId = linkedinClientId;
    clientSecret = linkedinClientSecret;
  } else if (isMetaChannel) {
    clientId = metaClientId || getEnvClean(`${type}_CLIENT_ID`);
    clientSecret = metaClientSecret || getEnvClean(`${type}_CLIENT_SECRET`);
  } else {
    clientId = getEnvClean(`${type}_CLIENT_ID`);
    clientSecret = getEnvClean(`${type}_CLIENT_SECRET`);
  }

  const authUrl = getEnvClean(`${type}_AUTH_URL`) || defaults?.authUrl || "";
  const tokenUrl = getEnvClean(`${type}_TOKEN_URL`) || defaults?.tokenUrl || "";
  const profileUrl = getEnvClean(`${type}_PROFILE_URL`) || defaults?.profileUrl || "";
  const rawScopes = getEnvClean(`${type}_SCOPES`);
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

      // Meta OAuth: force re-request and enable profile/page selector so user is prompted to select/grant their Facebook Pages
      if (isMeta) {
        params.append('auth_type', 'rerequest');
        params.append('return_scopes', 'true');
        params.append('enable_profile_selector', 'true');
      }

      // YouTube requires offline access to issue a refresh token
      if (type === ChannelTypeEnum.YOUTUBE) {
        params.append('access_type', 'offline');
        params.append('prompt', 'consent');
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
        let igErrorDetails = "";
        try {
          // Method 1: Scan all Facebook Pages for connected Instagram Business/Creator Account
          const igRes = await fetch(`https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            }
          });
          if (igRes.ok) {
            const igData = await igRes.json();
            const pages = igData?.data || [];
            let pageWithIg = pages.find((p: any) => p.instagram_business_account?.id || p.connected_instagram_account?.id);
            
            // Method 1b: If not in bulk list, query each Page directly using its Page Access Token
            if (!pageWithIg && pages.length > 0) {
              for (const p of pages) {
                if (p.id && p.access_token) {
                  try {
                    const pageDetailRes = await fetch(`https://graph.facebook.com/v22.0/${p.id}?fields=id,name,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(p.access_token)}`);
                    if (pageDetailRes.ok) {
                      const pageDetail = await pageDetailRes.json();
                      const resolvedIg = pageDetail?.instagram_business_account || pageDetail?.connected_instagram_account;
                      if (resolvedIg?.id) {
                        p.instagram_business_account = resolvedIg;
                        pageWithIg = p;
                        break;
                      }
                    }
                  } catch (pageErr) {
                    console.warn(`[Instagram OAuth] Notice checking page ${p.id}:`, pageErr);
                  }
                }
              }
            }

            if (pageWithIg) {
              const ig = pageWithIg.instagram_business_account || pageWithIg.connected_instagram_account;
              const igHandle = ig.username || ig.name;
              return {
                providerAccountId: ig.id,
                handle: igHandle ? `@${igHandle.replace(/^@/, '')}` : null,
                profileImage: ig.profile_picture_url || null,
                pageAccessToken: pageWithIg.access_token || accessToken,
              };
            } else if (pages.length > 0) {
              igErrorDetails = `Found ${pages.length} Facebook Page(s) ("${pages.map((p: any) => p.name).join('", "')}"), but none have a connected Instagram Professional account.`;
            } else {
              igErrorDetails = "No Facebook Pages found on this Meta account.";
            }
          }
        } catch (igErr: any) {
          console.warn("[Instagram OAuth] Notice checking me/accounts:", igErr);
        }

        // Method 2: Direct query on /me for instagram_business_account or nested accounts
        try {
          const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name,username,profile_picture_url,instagram_business_account{id,username,name,profile_picture_url},accounts{id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}}&access_token=${encodeURIComponent(accessToken)}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData?.instagram_business_account?.id) {
              const ig = meData.instagram_business_account;
              const igHandle = ig.username || ig.name;
              return {
                providerAccountId: ig.id,
                handle: igHandle ? `@${igHandle.replace(/^@/, '')}` : null,
                profileImage: ig.profile_picture_url || null,
                pageAccessToken: accessToken,
              };
            }
            // Check nested accounts
            const nestedAccounts = meData?.accounts?.data || [];
            const nestedWithIg = nestedAccounts.find((a: any) => a.instagram_business_account?.id);
            if (nestedWithIg?.instagram_business_account) {
              const ig = nestedWithIg.instagram_business_account;
              const igHandle = ig.username || ig.name;
              return {
                providerAccountId: ig.id,
                handle: igHandle ? `@${igHandle.replace(/^@/, '')}` : null,
                profileImage: ig.profile_picture_url || null,
                pageAccessToken: nestedWithIg.access_token || accessToken,
              };
            }
            // Check if /me is already an Instagram user or Page
            if (meData?.username && (meData?.id?.length > 14 || meData?.profile_picture_url)) {
              return {
                providerAccountId: meData.id,
                handle: `@${meData.username.replace(/^@/, '')}`,
                profileImage: meData.profile_picture_url || null,
                pageAccessToken: accessToken,
              };
            }
          }
        } catch {}

        // Method 3: Instagram Graph / Basic Display API fallback
        try {
          const igBasicRes = await fetch(`https://graph.instagram.com/me?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`);
          if (igBasicRes.ok) {
            const igBasicData = await igBasicRes.json();
            if (igBasicData?.id) {
              return {
                providerAccountId: igBasicData.id,
                handle: igBasicData.username ? `@${igBasicData.username.replace(/^@/, '')}` : null,
                profileImage: igBasicData.profile_picture_url || null,
                pageAccessToken: accessToken,
              };
            }
          }
        } catch {}

        throw new Error(
          `No Instagram Business/Creator account detected on this Meta login (${igErrorDetails}). Please ensure: 1) Your Instagram account is switched to a Professional (Creator or Business) Account, 2) It is linked to a Facebook Page in your Instagram account settings or Meta Business Suite, and 3) You grant access to that Page when logging in.`
        );
      }

      // Resolve user's primary Facebook Page and Page Access Token for Facebook
      if (type === ChannelTypeEnum.FACEBOOK) {
        let pageErrorDetails = "";
        // Method 1: Scan user's managed Facebook Pages
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

        // Method 2: Check /me for nested accounts or direct Page token
        try {
          const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name,picture{url},accounts{id,name,access_token,picture{url}}&access_token=${encodeURIComponent(accessToken)}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            const nestedPages = meData?.accounts?.data || [];
            if (nestedPages.length > 0) {
              const primaryPage = nestedPages[0];
              return {
                providerAccountId: primaryPage.id,
                handle: primaryPage.name || null,
                profileImage: primaryPage.picture?.data?.url || null,
                pageAccessToken: primaryPage.access_token || accessToken,
              };
            }
            // If the token is already a Page Access Token (where /me returns the page itself)
            if (meData?.id && meData?.name) {
              return {
                providerAccountId: meData.id,
                handle: meData.name,
                profileImage: meData.picture?.data?.url || null,
                pageAccessToken: accessToken,
              };
            }
          }
        } catch (meErr) {
          console.warn("[Facebook OAuth] Notice checking /me:", meErr);
        }

        // Meta Graph API strictly requires a Facebook Page to schedule and publish posts.
        throw new Error(
          `No Facebook Page found on this account${pageErrorDetails}. Meta requires a Facebook Page to publish posts (personal profiles cannot be published to via API). Please ensure: 1) You have a Facebook Page created, 2) Your Facebook account has Admin access to that Page, and 3) You grant access to that Page in the Meta login dialog.`
        );
      }

      // YouTube: Fetch verified Channel ID, handle, and avatar from YouTube Data API v3
      if (type === ChannelTypeEnum.YOUTUBE) {
        try {
          const ytRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          });
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            const channel = ytData?.items?.[0];
            if (channel) {
              const chSnippet = channel.snippet;
              const chHandle = chSnippet?.customUrl || (chSnippet?.title ? `@${chSnippet.title.replace(/\s+/g, '')}` : null);
              const chImage = chSnippet?.thumbnails?.high?.url || chSnippet?.thumbnails?.medium?.url || chSnippet?.thumbnails?.default?.url || null;
              return {
                providerAccountId: channel.id,
                handle: chHandle,
                profileImage: chImage,
                pageAccessToken: accessToken,
              };
            }
          }
        } catch (ytErr) {
          console.warn("[YouTube OAuth] Notice fetching channels?mine=true:", ytErr);
        }
      }

      // LinkedIn: OpenID Connect UserInfo profile resolution
      if (type === ChannelTypeEnum.LINKEDIN) {
        try {
          const liRes = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          });
          if (liRes.ok) {
            const liData = await liRes.json();
            const liId = liData.sub || liData.id || null;
            const liName = liData.name || `${liData.given_name || ''} ${liData.family_name || ''}`.trim() || null;
            const liPicture = liData.picture || null;
            return {
              providerAccountId: liId,
              handle: liName,
              profileImage: liPicture,
              pageAccessToken: accessToken,
            };
          }
        } catch (liErr) {
          console.warn("[LinkedIn OAuth] Notice fetching v2/userinfo:", liErr);
        }
      }

      // Twitter / X: Fetch verified user info
      if (type === ChannelTypeEnum.TWITTER) {
        try {
          const twRes = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          });
          if (twRes.ok) {
            const twData = await twRes.json();
            const twUser = twData?.data;
            if (twUser) {
              return {
                providerAccountId: twUser.id,
                handle: twUser.username ? `@${twUser.username.replace(/^@/, '')}` : (twUser.name || null),
                profileImage: twUser.profile_image_url || null,
                pageAccessToken: accessToken,
              };
            }
          }
        } catch (twErr) {
          console.warn("[Twitter OAuth] Notice fetching users/me:", twErr);
        }
      }

      // General fallback to profileUrl for other providers
      const profileUrlWithToken = config.profileUrl;

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
