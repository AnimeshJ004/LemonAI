import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { ChannelTypeEnum } from "@/constants/channels";
import { getOAuthProvider, isProviderConfigured } from "@/lib/social-oauth";
import { createOAuthState } from "@/lib/social-oauth/state";
import { createPkcePair, getPkceCookieName } from "@/lib/social-oauth/pkce";
import { getAppUrl } from "@/lib/app-url";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", appUrl));
    }

    const { searchParams } = new URL(request.url);
    const channelTypeId = searchParams.get("channelTypeId");
    const channelTypeParam = searchParams.get("channelType");
    const redirectTo = searchParams.get("redirectTo") || `${appUrl}/settings?tab=channels`;

    const { insforge } = await getInsforgeServerClient();

    // Look up channel type
    let channelRow: any = null;
    if (channelTypeId) {
      const { data } = await insforge.database
        .from("channel_types")
        .select("*")
        .eq("id", channelTypeId)
        .maybeSingle();
      channelRow = data;
    } else if (channelTypeParam) {
      const { data } = await insforge.database
        .from("channel_types")
        .select("*")
        .eq("type", channelTypeParam)
        .maybeSingle();
      channelRow = data;
    }

    if (!channelRow) {
      return NextResponse.redirect(
        new URL(`/settings?tab=channels&error=invalid_channel_type`, appUrl)
      );
    }

    const type = channelRow.type as ChannelTypeEnum;
    const provider = getOAuthProvider(type);

    if (!provider || !isProviderConfigured(type)) {
      return NextResponse.redirect(
        new URL(
          `/settings?tab=channels&error=oauth_not_configured&channel=${type}&help=Add_${type}_CLIENT_ID_in_env`,
          appUrl
        )
      );
    }

    const redirectUri = `${appUrl}/api/channel/callback`;

    // Create OAuth state with embedded redirectUri for 100% callback match
    const state = createOAuthState({
      userId,
      channelTypeId: channelRow.id,
      channelType: type,
      redirectTo,
      redirectUri,
    });

    // Handle PKCE for Twitter / X
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;
    let codeChallengeMethod: string | undefined;

    if (type === ChannelTypeEnum.TWITTER) {
      const pkce = createPkcePair();
      codeVerifier = pkce.codeVerifier;
      codeChallenge = pkce.codeChallenge;
      codeChallengeMethod = pkce.codeChallengeMethod;
    }

    const authUrl = provider.getAuthorizationUrl({
      state,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
    });

    const response = NextResponse.redirect(new URL(authUrl));

    if (codeVerifier) {
      const pkceCookieName = getPkceCookieName(state);
      response.cookies.set(pkceCookieName, codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
        path: "/",
      });
    }

    return response;
  } catch (error: any) {
    console.error("OAuth initiation error:", error);
    return NextResponse.redirect(
      new URL(`/settings?tab=channels&error=oauth_init_failed`, appUrl)
    );
  }
}
