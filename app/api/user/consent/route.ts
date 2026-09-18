import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  CONSENT_TYPES,
  ConsentType,
  listUserConsents,
  recordConsent,
} from "@/lib/consent";
import { reportError } from "@/lib/observability";

/**
 * GET  /api/user/consent
 *   Returns the caller's current effective consent state for every consent
 *   type Lemon AI tracks. Response:
 *     { consents: { [consentType]: { granted, version, createdAt } | null } }
 *
 * POST /api/user/consent
 *   Body: { consentType: string, granted: boolean, version?: string, metadata?: object }
 *   Records a grant or revoke event. Always creates a new immutable row.
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const consents = await listUserConsents(userId);
    // Materialize a shape that always contains every known consent type so the
    // client doesn't have to normalize.
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawType = String(body?.consentType || "");
  if (!(CONSENT_TYPES as readonly string[]).includes(rawType)) {
    return NextResponse.json(
      {
        error: `Unknown consentType. Allowed values: ${CONSENT_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (typeof body?.granted !== "boolean") {
    return NextResponse.json(
      { error: "'granted' must be a boolean" },
      { status: 400 }
    );
  }

  try {
    const record = await recordConsent({
      userId,
      consentType: rawType as ConsentType,
      granted: body.granted,
      version: typeof body.version === "string" ? body.version : "1.0",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
      metadata: typeof body.metadata === "object" && body.metadata !== null
        ? body.metadata
        : undefined,
    });

    if (!record) {
      return NextResponse.json(
        { error: "Failed to record consent" },
        { status: 500 }
      );
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
