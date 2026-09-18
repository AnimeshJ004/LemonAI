import { getInsforgeAdminClient } from "@/lib/insforge-server";
import { reportError, logInfo } from "@/lib/observability";
import { writeAuditEntry, AUDIT_EVENT } from "@/lib/audit-log";

/**
 * Data Retention Enforcement
 *
 * Reads the declarative rules from `data_retention_policies` (migration 12)
 * and issues bounded DELETE statements against each configured table:
 *
 *   DELETE FROM {table_name}
 *   WHERE {timestamp_col} < now() - interval '{retention_days} days'
 *
 * Called by the daily Inngest cron `data-retention-cron`, but can also be
 * invoked ad-hoc from an admin endpoint with `dryRun: true` to preview what
 * would be deleted without touching data.
 *
 * Safety guards:
 *   • Disabled unless DATA_RETENTION_ENABLED === "true".
 *   • Table names are validated against an internal allowlist so a corrupt
 *     policies row cannot cause deletion of a random table.
 *   • Every enforcement run writes an audit_logs entry summarizing counts.
 *   • Never throws; always resolves with a structured result.
 */

// Allowlist of tables the retention engine is permitted to purge from.
// If you add a new retention policy row, also add the table name here.
const ALLOWED_TABLES = new Set<string>([
  "audit_logs",
  "replied_comments",
  "crm_messages",
  "crm_conversations",
  "social_comments",
  "social_dms",
  "flywheel_executions",
  "ai_memory",
  "dsr_requests",
  "scheduled_posts",
  "consent_records",
]);

// Timestamp columns are matched against a fixed regex to prevent injection.
const TIMESTAMP_COL_RE = /^[a-z_][a-z0-9_]{0,63}$/;

export interface RetentionPolicy {
  id: string;
  tableName: string;
  timestampCol: string;
  retentionDays: number;
  description: string | null;
  active: boolean;
}

export interface TableRetentionResult {
  tableName: string;
  retentionDays: number;
  cutoffIso: string;
  deletedCount: number | null; // null when the DB doesn't return a count
  dryRun: boolean;
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface RetentionRunResult {
  enabled: boolean;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  totalDeleted: number;
  results: TableRetentionResult[];
}

export interface EnforceRetentionOptions {
  dryRun?: boolean;
  /** Override the env-var gate — useful for admin-triggered previews. */
  forceEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function enforceRetentionPolicies(
  opts: EnforceRetentionOptions = {}
): Promise<RetentionRunResult> {
  const startedAt = new Date().toISOString();
  const dryRun = !!opts.dryRun;

  const enabled = opts.forceEnabled || process.env.DATA_RETENTION_ENABLED === "true";

  if (!enabled) {
    return {
      enabled: false,
      dryRun,
      startedAt,
      finishedAt: new Date().toISOString(),
      totalDeleted: 0,
      results: [],
    };
  }

  const policies = await loadActivePolicies();
  const results: TableRetentionResult[] = [];
  let totalDeleted = 0;

  for (const policy of policies) {
    const result = await enforceOne(policy, dryRun);
    results.push(result);
    if (result.deletedCount) totalDeleted += result.deletedCount;
  }

  const finishedAt = new Date().toISOString();

  // Best-effort audit entry summarizing the run.
  void writeAuditEntry({
    actorType: "system",
    event: AUDIT_EVENT.ADMIN_RETENTION_ENFORCED,
    metadata: {
      dryRun,
      totalDeleted,
      tables: results.map((r) => ({
        table: r.tableName,
        deleted: r.deletedCount,
        skipped: r.skipped,
      })),
    },
  });

  logInfo("Retention run finished", {
    scope: "retention",
    extra: { dryRun, totalDeleted, tableCount: results.length },
  });

  return { enabled: true, dryRun, startedAt, finishedAt, totalDeleted, results };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function loadActivePolicies(): Promise<RetentionPolicy[]> {
  try {
    const admin = getInsforgeAdminClient();
    const { data, error } = await admin.database
      .from("data_retention_policies")
      .select("*")
      .eq("active", true);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      tableName: String(r.table_name),
      timestampCol: String(r.timestamp_col || "created_at"),
      retentionDays: Number(r.retention_days || 0),
      description: (r.description as string) ?? null,
      active: Boolean(r.active),
    }));
  } catch (err) {
    await reportError(err, { scope: "retention.load" }, "warning");
    return [];
  }
}

async function enforceOne(
  policy: RetentionPolicy,
  dryRun: boolean
): Promise<TableRetentionResult> {
  const cutoffIso = new Date(
    Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // ── Input hardening ────────────────────────────────────────────────────
  if (!ALLOWED_TABLES.has(policy.tableName)) {
    return skip(policy, cutoffIso, dryRun, `table '${policy.tableName}' not in allowlist`);
  }
  if (!TIMESTAMP_COL_RE.test(policy.timestampCol)) {
    return skip(policy, cutoffIso, dryRun, `timestamp column '${policy.timestampCol}' invalid`);
  }
  if (policy.retentionDays <= 0) {
    return skip(policy, cutoffIso, dryRun, "retention_days must be > 0");
  }

  try {
    const admin = getInsforgeAdminClient();

    if (dryRun) {
      // COUNT ONLY — no writes.
      const { count, error } = await admin.database
        .from(policy.tableName)
        .select("*", { count: "exact", head: true })
        .lt(policy.timestampCol, cutoffIso);
      if (error) throw error;
      return {
        tableName: policy.tableName,
        retentionDays: policy.retentionDays,
        cutoffIso,
        deletedCount: count ?? 0,
        dryRun: true,
        skipped: false,
      };
    }

    // Real deletion. Chunked select of ids then delete-in to keep the SQL
    // predicate simple and RLS-friendly across Supabase driver versions.
    const { count, error } = await admin.database
      .from(policy.tableName)
      .delete({ count: "exact" })
      .lt(policy.timestampCol, cutoffIso);

    if (error) throw error;

    return {
      tableName: policy.tableName,
      retentionDays: policy.retentionDays,
      cutoffIso,
      deletedCount: count ?? null,
      dryRun: false,
      skipped: false,
    };
  } catch (err: any) {
    await reportError(
      err,
      { scope: "retention.enforce", extra: { table: policy.tableName } },
      "warning"
    );
    return {
      tableName: policy.tableName,
      retentionDays: policy.retentionDays,
      cutoffIso,
      deletedCount: null,
      dryRun,
      skipped: true,
      skipReason: "db_error",
      error: err?.message ?? String(err),
    };
  }
}

function skip(
  policy: RetentionPolicy,
  cutoffIso: string,
  dryRun: boolean,
  reason: string
): TableRetentionResult {
  return {
    tableName: policy.tableName,
    retentionDays: policy.retentionDays,
    cutoffIso,
    deletedCount: null,
    dryRun,
    skipped: true,
    skipReason: reason,
  };
}
