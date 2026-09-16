import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeServerClient } from "@/lib/insforge-server";
import { encrypt, decrypt } from "@/lib/encryption";
import { ChannelTypeEnum } from "@/constants/channels";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { providerAccountId } = body;

    if (!providerAccountId) {
      return NextResponse.json({ error: "Missing providerAccountId" }, { status: 400 });
    }

    const cookie = request.cookies.get("lemon_meta_pending_selection")?.value;
    if (!cookie) {
      return NextResponse.json(
        { error: "Selection session expired. Please re-authorize through 1-Click OAuth." },
        { status: 400 }
      );
    }

    const decrypted = decrypt(cookie);
    if (!decrypted) {
      return NextResponse.json({ error: "Invalid selection session" }, { status: 400 });
    }

    const parsed = JSON.parse(decrypted);
    if (parsed.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetAccount = (parsed.accounts || []).find(
      (a: any) => a.providerAccountId === providerAccountId
    );

    if (!targetAccount) {
      return NextResponse.json({ error: "Selected account not found in available options" }, { status: 404 });
    }

    const { insforge } = await getInsforgeServerClient();

    const payload = {
      user_id: userId,
      channel_type_id: parsed.channelTypeId,
      provider_account_id: targetAccount.providerAccountId,
      handle: targetAccount.handle ?? null,
      profile_image: targetAccount.profileImage ?? null,
      // Instagram comment replies need the user token (instagram_manage_comments scope).
      // pageAccessToken is the Facebook Page token (needed for DM sending, stored on the FB channel row).
      // We use userAccessToken stored in the pending cookie from the OAuth flow.
      access_token: encrypt(parsed.userAccessToken || targetAccount.pageAccessToken),
      refresh_token: encrypt(parsed.refreshToken ?? null),
      token_expires_at: parsed.expiresAt ?? null,
      is_connected: true,
      is_active: true,
    };

    const { error: dbError } = await insforge.database
      .from("user_channels")
      .upsert(payload, {
        onConflict: "user_id,channel_type_id",
      });

    if (dbError) {
      return NextResponse.json({ error: `Database save failed: ${dbError.message}` }, { status: 500 });
    }

    // Subscribe Page to webhooks
    if (targetAccount.pageId && targetAccount.pageAccessToken) {
      try {
        await fetch(`https://graph.facebook.com/v22.0/${targetAccount.pageId}/subscribed_apps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscribed_fields: ["feed", "messages", "messaging_postbacks"],
            access_token: targetAccount.pageAccessToken,
          }),
        });
      } catch (subErr) {
        console.warn("[Select Account] Notice subscribing page to webhooks:", subErr);
      }
    }

    const response = NextResponse.json({
      success: true,
      handle: targetAccount.handle,
      providerAccountId: targetAccount.providerAccountId,
    });

    // Clear the pending selection cookie
    response.cookies.delete("lemon_meta_pending_selection");

    return response;
  } catch (error: any) {
    console.error("[Select Account] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save selected account" }, { status: 500 });
  }
}
