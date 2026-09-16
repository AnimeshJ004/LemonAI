/**
 * Meta Messaging Helper — Single Source of Truth for Sending DMs
 *
 * Problem this file solves:
 *   The prior codebase had DM-send logic duplicated across
 *   `social-comments-service.ts`, `crm-outbound-dispatcher.ts`, `meta-webhook.ts`,
 *   and `poll-social-dms.ts`. Each copy had subtle bugs (missing `messaging_type`,
 *   sending to `/me/messages` with a Page token, using IG Business Account ID
 *   instead of the Facebook Page ID, etc.), causing automatic DMs on
 *   Instagram/Facebook to silently drop.
 *
 * This module consolidates all outbound Meta messaging into three primitives:
 *   1. `sendMetaGraphMessage`        — thin, diagnostic HTTP wrapper (never throws)
 *   2. `resolveMetaSendCredentials`  — resolves Facebook Page ID + Page token
 *   3. `sendPrivateDM`               — orchestrates Instagram/Facebook DM delivery
 *                                      (Private Reply first for Instagram, then IGSID DM)
 *
 * All three return the structured `MetaSendResult` type so the caller can
 * distinguish between transient failures (code 10 — 24-hour window), permission
 * failures (code 200 — Meta Dev Mode / non-tester user), and code bugs.
 */

import { getInsforgeAdminClient } from "./insforge-server";
import { decrypt } from "./encryption";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetaSendStrategy =
  | "private_reply_by_comment_id" // Instagram: preferred path via webhook comment_id
  | "direct_dm_by_recipient_id"   // IG/FB: send to a known IGSID / PSID
  | "none";                        // No attempt made (missing prerequisites)

export interface MetaSendResult {
  ok: boolean;
  strategy: MetaSendStrategy;
  messageId?: string;
  recipientId?: string;
  /** Meta error code (e.g. 10 = messaging window closed, 200 = permissions). */
  errorCode?: number;
  /** Meta error subcode (nested `error.error_subcode`). */
  errorSubcode?: number;
  errorType?: string;
  errorMessage?: string;
  /** Free-form contextual note (e.g. which Page ID was used). */
  note?: string;
}

export interface SendMetaGraphMessageParams {
  /** Facebook Page ID (NOT the Instagram Business Account ID). */
  pageId: string;
  /** Page access token (already decrypted). */
  pageToken: string;
  /**
   * Recipient object as required by Meta:
   *   { id: "<IGSID or PSID>" }        — direct DM
   *   { comment_id: "<comment-id>" }   — Instagram Private Reply
   */
  recipient: { id?: string; comment_id?: string };
  /** Text body of the message. */
  text: string;
  /** Optional Graph API version override (defaults to v22.0). */
  apiVersion?: string;
  /** Optional strategy tag propagated into the returned result. */
  strategy?: MetaSendStrategy;
  /** Optional fetch timeout in ms (defaults to 8000). */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Task A1 — sendMetaGraphMessage
// ---------------------------------------------------------------------------

/**
 * Low-level, diagnostic HTTP wrapper around `POST /{pageId}/messages`.
 *
 * Guarantees:
 *   - Never throws. Every failure is captured in the returned `MetaSendResult`.
 *   - Always includes `messaging_type: "RESPONSE"` (required by Instagram; without
 *     it Meta returns error code 10 for messages outside the 24h window).
 *   - Logs the full Meta error object (code, subcode, type, message) so operators
 *     can distinguish permission/dev-mode failures from code bugs.
 */
export async function sendMetaGraphMessage(
  params: SendMetaGraphMessageParams
): Promise<MetaSendResult> {
  const {
    pageId,
    pageToken,
    recipient,
    text,
    apiVersion = "v22.0",
    strategy = "none",
    timeoutMs = 8000,
  } = params;

  // Guard: caller must supply either a recipient id (IGSID/PSID) OR a comment_id
  if (!recipient || (!recipient.id && !recipient.comment_id)) {
    return {
      ok: false,
      strategy,
      errorMessage: "Recipient must include either { id } or { comment_id }.",
    };
  }
  if (!pageId) {
    return { ok: false, strategy, errorMessage: "Missing Facebook Page ID." };
  }
  if (!pageToken) {
    return { ok: false, strategy, errorMessage: "Missing Page access token." };
  }
  if (!text || !text.trim()) {
    return { ok: false, strategy, errorMessage: "Empty message body." };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${pageId}/messages`;
  const body = {
    recipient,
    message: { text },
    messaging_type: "RESPONSE",
    access_token: pageToken,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const json = await res.json().catch(() => ({} as any));

    if (res.ok && (json?.message_id || json?.recipient_id)) {
      return {
        ok: true,
        strategy,
        messageId: json.message_id,
        recipientId: json.recipient_id,
      };
    }

    const errCode = json?.error?.code;
    const errSubcode = json?.error?.error_subcode;
    const errType = json?.error?.type;
    const errMsg = json?.error?.message || JSON.stringify(json);

    // Emit a single structured log line so operators can grep it easily.
    console.warn(
      `[Meta Messaging] send failed (strategy=${strategy}, pageId=${pageId}, code=${errCode}, subcode=${errSubcode}): ${errMsg}`
    );

    return {
      ok: false,
      strategy,
      errorCode: errCode,
      errorSubcode: errSubcode,
      errorType: errType,
      errorMessage: errMsg,
    };
  } catch (err: any) {
    const msg = err?.name === "TimeoutError" ? "Meta Graph API request timed out" : err?.message || String(err);
    console.warn(`[Meta Messaging] network error (strategy=${strategy}, pageId=${pageId}): ${msg}`);
    return {
      ok: false,
      strategy,
      errorMessage: msg,
    };
  }
}

// ---------------------------------------------------------------------------
// Task A2 — resolveMetaSendCredentials
// ---------------------------------------------------------------------------

export interface ResolveMetaSendCredentialsParams {
  userId: string;
  /** "INSTAGRAM" | "FACEBOOK" | (case-insensitive) */
  platform?: string | null;
  /** Instagram Business Account ID from the webhook, if known. */
  igAccountId?: string | null;
  /**
   * Fallback access token (typically the Instagram token from the webhook).
   * Used only if we cannot find a Facebook channel record for the user.
   */
  accessToken?: string | null;
}

export interface MetaSendCredentials {
  pageId: string | null;
  pageToken: string | null;
  /** Which resolution branch produced these credentials — useful for logs. */
  source: "fb_channel" | "me_accounts_lookup" | "fallback_ig_id" | "none";
}

/**
 * Resolves the Facebook Page ID + Page access token that Meta requires for
 * Instagram/Facebook Messaging API calls.
 *
 * Resolution order:
 *   1. Look up a connected FACEBOOK channel for this user (fastest, most reliable).
 *   2. If only Instagram is connected, query `/me/accounts` via the IG token
 *      and match the Page whose `instagram_business_account.id` == `igAccountId`.
 *   3. As a last resort, return `igAccountId` as the "page id" with the raw
 *      token — this will usually still fail, but it lets callers report a
 *      structured error instead of silently no-op'ing.
 */
export async function resolveMetaSendCredentials(
  params: ResolveMetaSendCredentialsParams
): Promise<MetaSendCredentials> {
  const { userId, igAccountId, accessToken } = params;

  // ── Branch 1: Look up connected Facebook channel ──────────────────────────
  try {
    const admin = getInsforgeAdminClient();
    const { data: channels } = await admin.database
      .from("user_channels")
      .select("*, channel_types(*)")
      .eq("user_id", userId);

    const fbCh = (channels || []).find(
      (c: any) =>
        c?.channel_types?.type === "FACEBOOK" &&
        c?.access_token &&
        c?.provider_account_id
    );

    if (fbCh?.provider_account_id && fbCh?.access_token) {
      const token = decrypt(fbCh.access_token) || fbCh.access_token;
      return {
        pageId: String(fbCh.provider_account_id),
        pageToken: token,
        source: "fb_channel",
      };
    }
  } catch (dbErr) {
    console.warn("[Meta Messaging] resolve: user_channels lookup notice:", dbErr);
  }

  // ── Branch 2: Look up Page via /me/accounts using IG token ────────────────
  if (igAccountId && accessToken) {
    try {
      const url = `https://graph.facebook.com/v22.0/me/accounts?fields=id,access_token,instagram_business_account{id}&access_token=${encodeURIComponent(
        accessToken
      )}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({} as any));
        const pages: any[] = data?.data || [];
        const matchedPage = pages.find(
          (p) => p?.instagram_business_account?.id === igAccountId
        );
        if (matchedPage?.id) {
          return {
            pageId: String(matchedPage.id),
            // If Meta returned a page-scoped access_token, prefer it; otherwise reuse the caller's token.
            pageToken: matchedPage.access_token || accessToken,
            source: "me_accounts_lookup",
          };
        }
      }
    } catch (accErr) {
      console.warn("[Meta Messaging] resolve: /me/accounts lookup notice:", accErr);
    }
  }

  // ── Branch 3: Last-resort fallback ────────────────────────────────────────
  if (igAccountId && accessToken) {
    return {
      pageId: String(igAccountId),
      pageToken: accessToken,
      source: "fallback_ig_id",
    };
  }

  return { pageId: null, pageToken: null, source: "none" };
}

// ---------------------------------------------------------------------------
// Task A3 — sendPrivateDM (unified orchestrator)
// ---------------------------------------------------------------------------

export interface SendPrivateDMParams {
  userId: string;
  /** "INSTAGRAM" | "FACEBOOK" (case-insensitive). Defaults to INSTAGRAM. */
  platform?: string;
  /** Comment ID from the webhook — enables the Private Reply strategy on IG. */
  commentId?: string | null;
  /** IGSID / PSID of the recipient, if known. Often missing on IG comments. */
  commenterId?: string | null;
  /** Instagram Business Account ID from the webhook, if known. */
  igAccountId?: string | null;
  /**
   * Fallback token (typically the token stored on the IG channel record).
   * Only used when the FB-channel lookup fails.
   */
  accessToken?: string | null;
  /** Message body. */
  dmMessage: string;
}

/**
 * Unified DM sender that gracefully picks the correct Meta strategy:
 *
 *   Instagram:
 *     A. Private Reply via `recipient: { comment_id }`   (primary; works even
 *        when the commenter's IGSID is unknown — the most common case).
 *     B. Direct DM via `recipient: { id: <IGSID> }`      (fallback; requires
 *        the commenter to have messaged the account before OR to be an app
 *        tester in Dev Mode).
 *
 *   Facebook:
 *     • Direct DM via `recipient: { id: <PSID> }`.
 *
 * All calls include `messaging_type: "RESPONSE"`. Returns the FIRST successful
 * attempt, or the LAST failure if all attempts failed.
 */
export async function sendPrivateDM(params: SendPrivateDMParams): Promise<MetaSendResult> {
  const {
    userId,
    platform = "INSTAGRAM",
    commentId,
    commenterId,
    igAccountId,
    accessToken,
    dmMessage,
  } = params;

  if (!dmMessage || !dmMessage.trim()) {
    return { ok: false, strategy: "none", errorMessage: "Empty DM message body." };
  }

  const upper = String(platform).toUpperCase();
  const isFacebook = upper === "FACEBOOK";

  // 1. Resolve Page ID + Page token (source of truth for messaging endpoints).
  const creds = await resolveMetaSendCredentials({
    userId,
    platform: upper,
    igAccountId,
    accessToken,
  });

  if (!creds.pageId || !creds.pageToken) {
    return {
      ok: false,
      strategy: "none",
      errorMessage:
        "Could not resolve Facebook Page ID / Page token. Connect the Facebook Page for this account in Settings → Channels.",
    };
  }

  console.log(
    `[Meta Messaging] sendPrivateDM: platform=${upper}, pageId=${creds.pageId}, source=${creds.source}, hasCommentId=${Boolean(
      commentId
    )}, hasCommenterId=${Boolean(commenterId)}`
  );

  let lastFailure: MetaSendResult | null = null;

  // ── Instagram strategy A: Private Reply by comment_id (PRIMARY) ─────────────
  if (!isFacebook && commentId) {
    const prResult = await sendMetaGraphMessage({
      pageId: creds.pageId,
      pageToken: creds.pageToken,
      recipient: { comment_id: commentId },
      text: dmMessage,
      strategy: "private_reply_by_comment_id",
    });

    if (prResult.ok) {
      console.log(
        `[Meta Messaging] ✓ Instagram Private Reply sent to comment ${commentId} via Page ${creds.pageId}`
      );
      return { ...prResult, note: `pageId=${creds.pageId}, source=${creds.source}` };
    }
    lastFailure = prResult;
  }

  // ── Direct DM by recipient ID (IGSID or PSID) ───────────────────────────────
  if (commenterId) {
    const dmResult = await sendMetaGraphMessage({
      pageId: creds.pageId,
      pageToken: creds.pageToken,
      recipient: { id: commenterId },
      text: dmMessage,
      strategy: "direct_dm_by_recipient_id",
    });

    if (dmResult.ok) {
      console.log(
        `[Meta Messaging] ✓ Direct DM sent to ${commenterId} via Page ${creds.pageId} (${upper})`
      );
      return { ...dmResult, note: `pageId=${creds.pageId}, source=${creds.source}` };
    }
    lastFailure = dmResult;
  }

  // No strategy succeeded — return the most informative failure.
  if (lastFailure) return { ...lastFailure, note: `pageId=${creds.pageId}, source=${creds.source}` };

  return {
    ok: false,
    strategy: "none",
    errorMessage: isFacebook
      ? "Facebook DM requires a recipient PSID (commenterId). None provided."
      : "Instagram DM requires either a commentId (Private Reply) or an IGSID (direct DM). Neither provided.",
    note: `pageId=${creds.pageId}, source=${creds.source}`,
  };
}
