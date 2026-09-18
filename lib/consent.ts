import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { hashIP } from "@/lib/pii-redactor";
import { reportError } from "@/lib/observability";
import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";

/**
 * Consent Management
 *
 * Records and queries user consent under GDPR Art. 7 and DPDP Sec. 6.
 * A consent record is immutable — a "revoke" is a new row with granted=false,
 * so the full grant/revoke history is auditable.
 *
 * Design guarantees:
 *   • Every write is best-effort; failures do not block the caller.
 *   • Reads FAIL OPEN — if the consent_records table is unreachable, non-
 *     essential consent checks (`hasConsent`) return `true`. This preserves
 *     existing app behavior for users who signed up before the consent module
 *     was deployed. Callers that must fail closed (e.g. marketing sends)
 *     should check `hasExplicitConsent()` instead.
 */

export type ConsentType =
  | "terms_of_service"
  | "privacy_policy"
  | "marketing_emails"
  | "analytics_cookies"
  | "ai_training"
  | "data_processing"
  | "third_party_sharing";

export const CONSENT_TYPES: readonly ConsentType[] = [
  "terms_of_service",
  "privacy_policy",
  "marketing_emails",
  "analytics_cookies",
  "ai_training",
  "data_processing",
  "third_party_sharing",
] as const;

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  version: string;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface RecordConsentInput {
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  version?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

/**
 * Records a consent grant OR revocation. To revoke a consent, call with
 * `granted: false` — do not mutate an existing row.
 *
 * Also emits an audit_logs entry so the consent change appears in the user's
 * audit trail alongside other privacy events.
 */
export async function recordConsent(input: RecordConsentInput): Promise<ConsentRecord | null> {
  if (!input.userId || !input.consentType) return null;

  try {
    const admin = getInsforgeAdminClient();
    const row = {
      user_id: input.userId,
      consent_type: input.consentType,
      granted: input.granted,
      version: input.version ?? "1.0",
      ip_hash: input.ip ? hashIP(input.ip) : null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await admin.database
      .from("consent_records")
      .insert(row)
      .select("*")
      .single();

    if (error || !data) {
      await reportError(
        new Error(`Consent write failed: ${error?.message || "no data"}`),
        { scope: "consent", extra: { consentType: input.consentType } },
        "warning"
      );
      return null;
    }

    // Fire-and-forget audit trail.
    void writeAuditEntry({
      userId: input.userId,
      event: input.granted ? AUDIT_EVENT.CONSENT_GRANTED : AUDIT_EVENT.CONSENT_REVOKED,
      resourceType: "consent_record",
      resourceId: String((data as any).id),
      metadata: { consentType: input.consentType, version: row.version },
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });

    return mapRow(data as Record<string, unknown>);
  } catch (err) {
    await reportError(err, { scope: "consent" }, "warning");
    return null;
  }
}

/** Convenience wrapper: revoke a previously granted consent. */
export async function revokeConsent(
  userId: string,
  consentType: ConsentType,
  meta: { ip?: string | null; userAgent?: string | null; metadata?: Record<string, unknown> } = {}
): Promise<ConsentRecord | null> {
  return recordConsent({
    userId,
    consentType,
    granted: false,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    metadata: meta.metadata,
  });
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/**
 * Returns the LATEST record per consent_type for the user (grant or revoke),
 * which is what "current effective consent" means.
 */
export async function listUserConsents(userId: string): Promise<ConsentRecord[]> {
  if (!userId) return [];
  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("consent_records")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    // Keep only the most recent row per consent_type.
    const seen = new Set<string>();
    const latest: ConsentRecord[] = [];
    for (const raw of data as Array<Record<string, unknown>>) {
      const type = String(raw.consent_type);
      if (seen.has(type)) continue;
      seen.add(type);
      latest.push(mapRow(raw));
    }
    return latest;
  } catch (err) {
    await reportError(err, { scope: "consent.list", userId }, "warning");
    return [];
  }
}

/**
 * Fail-OPEN consent check.
 *
 * Returns `true` when the user has explicitly granted OR when no record
 * exists at all. Use this for backward-compatible, non-essential features
 * (e.g. showing an analytics banner). For hard-gated flows use
 * `hasExplicitConsent`.
 */
export async function hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
  const record = await getLatestConsent(userId, consentType);
  if (!record) return true; // fail-open
  return record.granted;
}

/**
 * Fail-CLOSED consent check.
 *
 * Returns `true` ONLY when the user has an explicit `granted: true` record.
 * Use for GDPR / DPDP Art. 7 sensitive operations (marketing emails,
 * third-party sharing, AI training on user data).
 */
export async function hasExplicitConsent(
  userId: string,
  consentType: ConsentType
): Promise<boolean> {
  const record = await getLatestConsent(userId, consentType);
  return !!record && record.granted === true;
}

async function getLatestConsent(
  userId: string,
  consentType: ConsentType
): Promise<ConsentRecord | null> {
  if (!userId || !consentType) return null;
  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("consent_records")
      .select("*")
      .eq("user_id", userId)
      .eq("consent_type", consentType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch (err) {
    await reportError(err, { scope: "consent.get", userId }, "warning");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(raw: Record<string, unknown>): ConsentRecord {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    consentType: raw.consent_type as ConsentType,
    granted: Boolean(raw.granted),
    version: String(raw.version ?? "1.0"),
    ipHash: (raw.ip_hash as string) ?? null,
    userAgent: (raw.user_agent as string) ?? null,
    createdAt: String(raw.created_at),
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
  };
}
