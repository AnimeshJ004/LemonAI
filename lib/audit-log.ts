import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { hashIP, redactPII } from "@/lib/pii-redactor";
import { reportError } from "@/lib/observability";

/**
 * Audit Log Service
 *
 * Append-only trail of security- and privacy-sensitive events. Written via the
 * admin/service-role Supabase client — regular user tokens cannot INSERT into
 * `audit_logs` under RLS (see migration 12). Users may only SELECT their own
 * entries via `/api/user/audit-log` if that route is later added.
 *
 * Design guarantees:
 *   • Every write is best-effort and non-throwing. A failed audit write logs
 *     via observability but MUST NOT break the caller's business logic.
 *   • No raw PII is written: `metadata` is passed through `redactPII` first,
 *     IP addresses are hashed via `hashIP` before insertion.
 *   • Timestamps come from Postgres `now()` — clients cannot forge event time.
 */

// ---------------------------------------------------------------------------
// Event catalog — canonical list of audit event names.
// ---------------------------------------------------------------------------

export const AUDIT_EVENT = {
  // Authentication & lifecycle
  AUTH_LOGIN: "auth.login",
  AUTH_SIGNUP: "auth.signup",
  AUTH_LOGOUT: "auth.logout",
  AUTH_PASSWORD_RESET: "auth.password_reset",

  // Account lifecycle
  ACCOUNT_DELETION_REQUESTED: "account.deletion_requested",
  ACCOUNT_DELETION_COMPLETED: "account.deletion_completed",
  ACCOUNT_DATA_EXPORTED: "account.data_exported",

  // Consent
  CONSENT_GRANTED: "consent.granted",
  CONSENT_REVOKED: "consent.revoked",

  // Social channel lifecycle
  CHANNEL_CONNECTED: "channel.connected",
  CHANNEL_DISCONNECTED: "channel.disconnected",
  CHANNEL_TOKEN_REFRESHED: "channel.token_refreshed",
  CHANNEL_TOKEN_REFRESH_FAILED: "channel.token_refresh_failed",

  // Admin / operator actions
  ADMIN_CACHE_CLEARED: "admin.cache_cleared",
  ADMIN_RETENTION_ENFORCED: "admin.retention_enforced",

  // DSR lifecycle
  DSR_REQUEST_CREATED: "dsr.request_created",
  DSR_REQUEST_FULFILLED: "dsr.request_fulfilled",
  DSR_REQUEST_REJECTED: "dsr.request_rejected",

  // Security incidents
  SECURITY_RATE_LIMIT_HIT: "security.rate_limit_hit",
  SECURITY_UNAUTHORIZED_ACCESS: "security.unauthorized_access",
} as const;

export type AuditEventName = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];

export type ActorType = "user" | "system" | "admin" | "anonymous" | "webhook";

export interface AuditEntryInput {
  /** Subject of the event (whose data is affected). Null for anonymous. */
  userId?: string | null;
  /** Performer of the event. Usually the same as userId. */
  actorUserId?: string | null;
  actorType?: ActorType;
  event: AuditEventName | string;
  resourceType?: string;
  resourceId?: string;
  /** Arbitrary structured context. Will be PII-redacted before persistence. */
  metadata?: Record<string, unknown>;
  /** Raw IP — will be one-way hashed. Never stored raw. */
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry extends AuditEntryInput {
  id: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Best-effort insert of an audit entry.
 *
 * Never throws. Never blocks the caller on network. If the table doesn't exist
 * yet (i.e. migration 12 hasn't been applied), the write silently fails and
 * the failure is surfaced through `reportError` at warning severity so ops
 * can see it in Sentry.
 */
export async function writeAuditEntry(input: AuditEntryInput): Promise<void> {
  try {
    const admin = getInsforgeAdminClient();

    const safeMetadata = input.metadata
      ? (redactPII(input.metadata) as Record<string, unknown>)
      : {};

    const row = {
      user_id: input.userId ?? null,
      actor_type: input.actorType ?? "user",
      actor_user_id: input.actorUserId ?? input.userId ?? null,
      event: input.event,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: safeMetadata,
      ip_hash: input.ip ? hashIP(input.ip) : null,
      user_agent: input.userAgent ?? null,
    };

    const { error } = await admin.database.from("audit_logs").insert(row);

    if (error) {
      // Surface at warning level — an audit write failure is important to
      // notice, but not important enough to break the request path.
      await reportError(
        new Error(`Audit write failed: ${error.message}`),
        { scope: "audit-log", extra: { event: input.event } },
        "warning"
      );
    }
  } catch (err) {
    // Absolute safety net — never let audit logging bubble out.
    try {
      await reportError(err, { scope: "audit-log", extra: { event: input.event } }, "warning");
    } catch {
      /* noop */
    }
  }
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

export interface ListAuditEntriesOptions {
  event?: AuditEventName | string;
  since?: Date;
  until?: Date;
  limit?: number;
}

/**
 * Reads audit entries for a specific user via the admin client. This is
 * intended for server-side use only (e.g. inside `/api/user/audit-log`
 * handlers or a DSR export). Never expose this function's return value to a
 * different user than `userId`.
 */
export async function listAuditEntriesForUser(
  userId: string,
  opts: ListAuditEntriesOptions = {}
): Promise<AuditEntry[]> {
  if (!userId) return [];

  try {
    const admin = getInsforgeAdminClient();
    let query = admin.database
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (opts.event) query = query.eq("event", opts.event);
    if (opts.since) query = query.gte("created_at", opts.since.toISOString());
    if (opts.until) query = query.lte("created_at", opts.until.toISOString());
    if (opts.limit && opts.limit > 0) query = query.limit(opts.limit);

    const { data, error } = await query;
    if (error || !data) return [];

    return (data as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      userId: (r.user_id as string) ?? null,
      actorUserId: (r.actor_user_id as string) ?? null,
      actorType: (r.actor_type as ActorType) ?? "user",
      event: (r.event as string) ?? "",
      resourceType: (r.resource_type as string) ?? undefined,
      resourceId: (r.resource_id as string) ?? undefined,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      ip: null, // Only ip_hash is stored; never returned as "ip".
      userAgent: (r.user_agent as string) ?? undefined,
      createdAt: String(r.created_at),
    }));
  } catch (err) {
    await reportError(err, { scope: "audit-log.list", userId }, "warning");
    return [];
  }
}
