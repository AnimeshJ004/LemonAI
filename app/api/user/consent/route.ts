import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  CONSENT_TYPES,
  ConsentType,
  listUserConsents,
  recordConsent,
} from "@/lib/consent";
import { ConsentType as ConsentTypeSchema, parseBody } from "@/lib/zod-helpers";
import { reportError } from "@/lib/observability";

/**
 * GET  /api/user/consent
 *   Returns the caller's current effective consent state for every consent
 *   type Lemon AI tracks. Response:
 *     { consents: { [consentType]: { granted, version, createdAt } | null } }
 *
 * POST /api/user/consent
 *   Body: { consentType: ConsentType, granted: boolean, version?: string, metadata?: object }
 *   Validated by `ConsentPostSchema` below. Always creates a new immutable row.
 */

const ConsentPostSchema = z.object({
  consentType: ConsentTypeSchema,
  granted: z.boolean(),
  version: z.string().trim().min(1).max(32).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const consents = await listUserConsents(userId);
    const byType: Record<
      string,
      { granted: boolean; version: string; createdAt: string } | null
    > = {};
    for (const t of CONSENT_TYPES) {
      byType[t] = null;
    }
    for (const c of consents) {
      byType[c.consentType] = {
        granted: c.granted,
        version: c.version,
        createdAt: c.createdAt,
      };
    }
    return NextResponse.json({ consents: byType });
  } catch (err) {
    await reportError(err, { scope: "api/user/consent GET", userId }, "error");
    return NextResponse.json({ error: "Failed to load consents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Zod validation — returns a 400 with per-field errors if the body is
  // malformed. `data` is fully typed on the happy path.
  const { data, errorResponse } = await parseBody(req, ConsentPostSchema);
  if (errorResponse) return errorResponse;

  try {
    const record = await recordConsent({
      userId,
      consentType: data!.consentType as ConsentType,
      granted: data!.granted,
      version: data!.version ?? "1.0",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
      metadata: data!.metadata,
    });

    if (!record) {
      return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        record: {
          consentType: record.consentType,
          granted: record.granted,
          version: record.version,
          createdAt: record.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    await reportError(err, { scope: "api/user/consent POST", userId }, "error");
    return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
  }
}
