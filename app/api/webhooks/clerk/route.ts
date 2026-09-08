import { NextRequest, NextResponse } from "next/server";
import { purgeAllUserData } from "@/lib/user-purge";
import crypto from "crypto";

/**
 * Clerk Webhook Handler
 * Specifically listens for `user.deleted` to completely erase user data
 * across all database tables (GDPR / DPDP compliance).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers = req.headers;

    const svixId = headers.get("svix-id");
    const svixTimestamp = headers.get("svix-timestamp");
    const svixSignature = headers.get("svix-signature");

    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret && svixId && svixTimestamp && svixSignature) {
      try {
        const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
        const secretBytes = webhookSecret.startsWith("whsec_")
          ? Buffer.from(webhookSecret.slice(6), "base64")
          : Buffer.from(webhookSecret, "utf-8");

        const computedSignature = crypto
          .createHmac("sha256", secretBytes)
          .update(signedContent)
          .digest("base64");

        const passedSignatures = svixSignature
          .split(" ")
          .map((s) => s.split(",")[1] || s);

        const isValid = passedSignatures.some((sig) => {
          try {
            return crypto.timingSafeEqual(
              Buffer.from(sig, "base64"),
              Buffer.from(computedSignature, "base64")
            );
          } catch {
            return false;
          }
        });

        if (!isValid) {
          console.warn("[Clerk Webhook] Invalid Svix signature verification.");
          return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }
      } catch (verifyErr) {
        console.warn("[Clerk Webhook] Signature verification warning:", verifyErr);
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventType = payload?.type;
    const userId = payload?.data?.id;

    console.log(`[Clerk Webhook] Received event: ${eventType} for user: ${userId}`);

    // Handle user.deleted
    if (eventType === "user.deleted" && userId) {
      const purgeResult = await purgeAllUserData(userId);
      return NextResponse.json({
        success: true,
        event: "user.deleted",
        purgedTables: purgeResult.purgedTables,
        message: `User ${userId} and all related data purged permanently from database.`,
      });
    }

    // Default response for other Clerk events (user.created, user.updated, etc.)
    return NextResponse.json({
      received: true,
      event: eventType,
      message: "Event acknowledged",
    });
  } catch (error: any) {
    console.error("[Clerk Webhook] Error processing event:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
