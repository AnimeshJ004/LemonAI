import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { ChannelTypeEnum } from "@/constants/channels";
import { getOAuthProvider, isProviderConfigured } from "@/lib/social-oauth";
import { createOAuthState } from "@/lib/social-oauth/state";
import { createPkcePair, getPkceCookieName } from "@/lib/social-oauth/pkce";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", APP_URL));
    }

    const { searchParams } = new URL(request.url);
    const channelTypeId = searchParams.get("channelTypeId");
    const channelTypeParam = searchParams.get("channelType");
    const redirectTo = searchParams.get("redirectTo") || `${APP_URL}/settings?tab=channels`;

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
        new URL(`/settings?tab=channels&error=invalid_channel_type`, APP_URL)
      );
    }

    const type = channelRow.type as ChannelTypeEnum;
    const provider = getOAuthProvider(type);

    if (!provider || !isProviderConfigured(type)) {
      return NextResponse.redirect(
        new URL(
          `/settings?tab=channels&error=oauth_not_configured&channel=${type}&help=Add_${type}_CLIENT_ID_in_env`,
          APP_URL
        )
      );
    }

    // Create OAuth state
    const state = createOAuthState({
      userId,
      channelTypeId: channelRow.id,
      channelType: type,
      redirectTo,
    });

    const redirectUri = `${APP_URL}/api/channel/callback`;

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
      new URL(`/settings?tab=channels&error=oauth_init_failed`, APP_URL)
    );
  }
}
