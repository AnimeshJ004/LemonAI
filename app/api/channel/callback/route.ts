import { ChannelTypeEnum } from "@/constants/channels";
import { encrypt, decrypt } from "@/lib/encryption";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { getOAuthProvider } from "@/lib/social-oauth";
import { getPkceCookieName } from "@/lib/social-oauth/pkce";
import { verifyOAuthState } from "@/lib/social-oauth/state";
import { OAuthProvider } from "@/lib/social-oauth/types";
import { getAppUrl } from "@/lib/app-url";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

function buildRedirectUrl(
    appUrl: string,
    redirectTo: string,
    params: Record<string, string>) {

    const url = new URL(redirectTo, appUrl);

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
    const appUrl = getAppUrl(request);
    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get('code');
    const code = rawCode ? rawCode.replace(/#_$/, '') : null;
    const stateParams = searchParams.get('state');
    const providerError = searchParams.get('error');
    const providerErrorDesc = searchParams.get('error_description') || searchParams.get('error_message') || providerError;

    if (!stateParams) {
        return buildRedirectUrl(appUrl, '/settings?tab=channels', {
            connected: "false",
            error: "missing_state"
        });
    }
    try {
        const state = verifyOAuthState(stateParams);
        const redirectTo = state?.redirectTo || `${appUrl}/settings?tab=channels`;
        const pkceCookieName = getPkceCookieName(stateParams);
        const codeVerifier = state.channelType === ChannelTypeEnum.TWITTER ? request.cookies.get(pkceCookieName)?.value : undefined;

        if (providerError) {
            const response = buildRedirectUrl(appUrl, redirectTo, {
                connected: "false",
                error: providerErrorDesc || providerError
            });
            response.cookies.delete(pkceCookieName);
            return response;
        }

        if (!code) {
            const response = buildRedirectUrl(appUrl, redirectTo, {
                connected: "false",
                error: "missing_code"
            });
            response.cookies.delete(pkceCookieName);
            return response;
        }

        const { insforge, userId } = await getInsforgeServerClient();

        if (!userId || userId !== state.userId) {
            const response = buildRedirectUrl(appUrl, redirectTo, {
                connected: "false",
                error: "missing_user"
            });
            response.cookies.delete(pkceCookieName);
            return response;
        }

        const provider = getOAuthProvider(state.channelType) as OAuthProvider;
        // Prioritize the exact redirectUri embedded in state so authorization and exchange are 100% identical
        const redirectUri = state.redirectUri || `${appUrl}/api/channel/callback`;

        const token = await provider.exchangeCodeForToken({
            code,
            redirectUri,
            codeVerifier
        });

        let profile: any;
        try {
            profile = await provider.getProfile({
                accessToken: token.accessToken
            });
        } catch (initialProfileErr: any) {
            // If Instagram profile resolution fails on user token, attempt resolution with user's connected Facebook Page token
            if (state.channelType === ChannelTypeEnum.INSTAGRAM) {
                try {
                    const { data: fbChannelType } = await insforge.database
                        .from("channel_types")
                        .select("id")
                        .eq("type", ChannelTypeEnum.FACEBOOK)
                        .maybeSingle();

                    if (fbChannelType?.id) {
                        const { data: fbUserChannel } = await insforge.database
                            .from("user_channels")
                            .select("access_token, provider_account_id")
                            .eq("user_id", state.userId)
                            .eq("channel_type_id", fbChannelType.id)
                            .maybeSingle();

                        if (fbUserChannel?.access_token) {
                            const decryptedFbToken = decrypt(fbUserChannel.access_token);
                            if (decryptedFbToken) {
                                profile = await provider.getProfile({
                                    accessToken: decryptedFbToken
                                });
                            }
                        }
                    }
                } catch (fbFallbackErr) {
                    console.warn("[OAuth Callback] Instagram fallback using connected Facebook token also failed:", fbFallbackErr);
                }
            }

            if (!profile) {
                throw initialProfileErr;
            }
        }

        console.log(`[OAuth Callback] Successfully connected ${state.channelType}:`, JSON.stringify({
          providerAccountId: profile.providerAccountId,
          handle: profile.handle,
        }));

        const payload = {
            user_id: state.userId,
            channel_type_id: state.channelTypeId,
            provider_account_id: profile.providerAccountId ?? null,
            handle: profile.handle ?? null,
            profile_image: profile.profileImage ?? null,
            access_token: encrypt((profile as any).pageAccessToken || token.accessToken),
            refresh_token: encrypt(token.refreshToken ?? null),
            token_expires_at: token.expiresAt ?? null,
            is_connected: true,
            is_active: true,
        };

        const { error } = await insforge.database
            .from("user_channels")
            .upsert(payload, {
                onConflict: "user_id,channel_type_id"
            });

        if (error) {
            const response = buildRedirectUrl(appUrl, redirectTo, {
                connected: "false",
                error: `Database save failed: ${error.message}`
            });
            response.cookies.delete(pkceCookieName);
            return response;
        }

        // Automatically subscribe Facebook Page / Instagram to Webhook events (feed, messages)
        if (state.channelType === ChannelTypeEnum.FACEBOOK || (profile as any)?.pageId) {
            const pageId = state.channelType === ChannelTypeEnum.FACEBOOK ? profile.providerAccountId : (profile as any)?.pageId;
            const pageToken = (profile as any)?.pageAccessToken || token.accessToken;
            if (pageId && pageToken) {
                try {
                    const subRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/subscribed_apps`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            subscribed_fields: ["feed", "messages", "messaging_postbacks"],
                            access_token: pageToken,
                        }),
                    });
                    const subData = await subRes.json().catch(() => ({}));
                    console.log(`[OAuth Callback] Page ${pageId} webhook subscription result:`, JSON.stringify(subData));
                } catch (subErr) {
                    console.warn("[OAuth Callback] Notice subscribing page to webhooks:", subErr);
                }
            }
        }

        const response = buildRedirectUrl(appUrl, redirectTo, {
            connected: "true",
            channelType: state.channelType,
        });
        response.cookies.delete(pkceCookieName);
        return response;
    } catch (error: any) {
        console.error('OAuth callback error:', error);
        const errMessage = error?.message || "oauth_callback_failed";
        
        let fallbackRedirect = `${appUrl}/settings?tab=channels`;
        const stateParams = new URL(request.url).searchParams.get('state');
        if (stateParams) {
          try {
            const parsed = verifyOAuthState(stateParams);
            if (parsed?.redirectTo) fallbackRedirect = parsed.redirectTo;
          } catch {}
        }

        const response = buildRedirectUrl(appUrl, fallbackRedirect, {
            connected: "false",
            error: errMessage
        });
        
        if (stateParams) {
            const pkceCookieName = getPkceCookieName(stateParams);
            response.cookies.delete(pkceCookieName);
        }
        return response;
    }
}
