import { ChannelTypeEnum } from "@/constants/channels"
import { createHmac, timingSafeEqual } from "crypto"


function getOAuthStateSecret(): string {
  const secret = process.env.CHANNEL_OAUTH_STATE_SECRET;
  if (secret && secret.trim().length >= 16) {
    return secret.trim();
  }
  // During build phase or static analysis, return a placeholder to prevent build failure
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "LemonAI_BuildPhase_OAuthSecret_Placeholder_32chars";
  }
  if (process.env.NODE_ENV === "production") {
    // In production runtime, check if an alternative secure server key is available as fallback
    const fallback = process.env.CLERK_SECRET_KEY || process.env.INSFORGE_PROJECT_API_KEY;
    if (fallback && fallback.trim().length >= 16) {
      console.warn(
        "[SECURITY WARNING] CHANNEL_OAUTH_STATE_SECRET not set in production. Using fallback server secret."
      );
      return fallback.trim();
    }
    throw new Error(
      "[SECURITY FATAL] CHANNEL_OAUTH_STATE_SECRET must be set in production with at least 16 characters."
    );
  }
  console.warn(
    "[SECURITY WARNING] CHANNEL_OAUTH_STATE_SECRET not set. Using fallback development secret."
  );
  return "LemonAI_DevOnly_OAuthSecret_ReplaceInProduction_32chars";
}

export type OAuthStatePayload = {
  userId: string
  channelTypeId: string
  channelType: ChannelTypeEnum
  redirectTo?: string
  redirectUri?: string
  exp: number
}
export function createOAuthState(payload: Omit<OAuthStatePayload, 'exp'> & {
    expiresInMs?: number
}) {
    const secret = getOAuthStateSecret();
    const statePayload: OAuthStatePayload = {
        ...payload,
        exp: Date.now() + (payload.expiresInMs ?? 10 * 60 * 1000)
    }
    const encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    const signature = createHmac('sha256', secret).update(encodedState).digest('base64url');

    return `${encodedState}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload {
    const [encodedState, signature] = state.split('.');
    if(!encodedState || !signature) {
        throw new Error('Invalid state format');
    }
    const secret = getOAuthStateSecret();
    const expectedSignature = createHmac('sha256', secret).update(encodedState).digest('base64url');

    const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    if (!isValid) {
        throw new Error('Invalid state signature');
    }
    const statePayload = JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf-8'));


    if (!statePayload.exp || statePayload.exp < Date.now()) {
        throw new Error('OAuth state expired');
    }
    return statePayload;
}