import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { writeAuditEntry, AUDIT_EVENT, listAuditEntriesForUser } from "@/lib/audit-log";
import { listUserConsents } from "@/lib/consent";
import { reportError } from "@/lib/observability";

/**
 * GET /api/user/data-export
 *
 * GDPR Art. 15 (right of access) + Art. 20 (portability) + DPDP Sec. 11
 * (right to summary of personal data). Returns a single JSON document with
 * every row the user owns across the platform.
 *
 * The response contains:
 *   • profile snapshot (from Clerk-derived user id)
 *   • brand profile
 *   • connected channels (with tokens redacted)
 *   • posts, ideas, leads, CRM conversations & messages, activities, DMs,
 *     comments, campaigns, memory, competitor research, pricing packages
 *   • consent history
 *   • the user's own audit trail entries
 *
 * Sensitive credentials (access_token, refresh_token, page_access_token) are
 * NEVER included in the export — only the fact that a channel is connected.
 *
 * Also creates a `dsr_requests` row (type='access', status='completed') for
 * regulator-facing evidence.
 */

// Tables where every row is keyed by user_id.
const USER_KEYED_TABLES = [
  "brand_profiles",
  "scheduled_posts",
  "ideas",
  "leads",
  "crm_conversations",
  "crm_activities",
  "social_comments",
  "social_dms",
  "ai_memory",
  "meta_campaigns",
  "competitor_researches",
  "flywheel_executions",
  "brand_pricing_packages",
  "replied_comments",
] as const;

// Columns that must be stripped from user_channels rows in the export.
const CHANNEL_SENSITIVE_COLUMNS = new Set([
  "access_token",
  "refresh_token",
  "page_access_token",
  "token_expires_at",
]);

export async function GET(req: NextRequest) {
  const startedAt = new Date().toISOString();

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getInsforgeAdminClient();

    // 1. Collect all user-keyed tables in parallel.
    const collections: Record<string, unknown[]> = {};
    await Promise.all(
      USER_KEYED_TABLES.map(async (table) => {
        try {
          const { data, error } = await admin.database
            .from(table)
            .select("*")
            .eq("user_id", userId);
          collections[table] = error ? [] : data ?? [];
        } catch {
          collections[table] = [];
        }
      })
    );

    // 2. user_channels — strip sensitive columns before export.
    let channels: unknown[] = [];
    try {
      const { data } = await admin.database
        .from("user_channels")
        .select("*")
        .eq("user_id", userId);
      channels = (data ?? []).map((row: Record<string, unknown>) => {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (CHANNEL_SENSITIVE_COLUMNS.has(k)) continue;
          cleaned[k] = v;
        }
        return cleaned;
      });
    } catch {
      channels = [];
    }

    // 3. crm_messages — traversed via the user's conversations.
    let crmMessages: unknown[] = [];
    try {
      const convRows = collections["crm_conversations"] as Array<{ id?: string }>;
      const convIds = convRows.map((c) => c.id).filter(Boolean) as string[];
      if (convIds.length > 0) {
        const { data } = await admin.database
          .from("crm_messages")
          .select("*")
          .in("conversation_id", convIds);
        crmMessages = data ?? [];
      }
    } catch {
      crmMessages = [];
    }

    // 4. Consents + audit history.
    const [consents, auditEntries] = await Promise.all([
      listUserConsents(userId),
      listAuditEntriesForUser(userId, { limit: 500 }),
    ]);

    // 5. DSR request record — proof of fulfilment for the regulator.
    try {
      await admin.database.from("dsr_requests").insert({
        user_id: userId,
        request_type: "access",
        status: "completed",
        fulfilled_at: new Date().toISOString(),
        metadata: { source: "self-service" },
      });
    } catch {
      /* best-effort */
    }

    // 6. Audit-log the export event itself.
    void writeAuditEntry({
      userId,
      event: AUDIT_EVENT.ACCOUNT_DATA_EXPORTED,
      resourceType: "user_data",
      resourceId: userId,
      metadata: {
        tableCount: USER_KEYED_TABLES.length + 3,
        exportSizeApprox: JSON.stringify(collections).length,
      },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    const payload = {
      meta: {
        userId,
        exportedAt: new Date().toISOString(),
        generatedIn: `${Date.now() - new Date(startedAt).getTime()}ms`,
        legalBasis: [
          "GDPR Art. 15 (Right of access)",
          "GDPR Art. 20 (Right to data portability)",
          "DPDP Act 2023 Sec. 11 (Right to information)",
          "CCPA §1798.100 (Right to know)",
        ],
        notice:
          "Sensitive credentials (OAuth access/refresh tokens) are intentionally excluded. "
          + "To request full deletion of your account and all data use DELETE /api/user/delete-account.",
      },
      data: {
        user_channels: channels,
        crm_messages: crmMessages,
        ...collections,
        consent_records: consents,
        audit_log: auditEntries,
      },
    };

    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="lemon-ai-data-export-${userId}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    await reportError(err, { scope: "api/user/data-export", userId }, "error");
    return NextResponse.json(
      { error: "Failed to export data. Please retry or contact support." },
      { status: 500 }
    );
  }
}
