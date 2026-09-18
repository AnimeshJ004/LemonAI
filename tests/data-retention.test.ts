import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Chainable Supabase-shaped mock. Each terminal awaits the next scripted
 * response. `select(...)` distinguishes between the head-only count path
 * (dryRun) and a real read; `delete(...)` triggers the delete path.
 */
function buildAdminMock() {
  const responseQueue: any[] = [];
  const fromCalls: string[] = [];

  const makeChain = () => {
    const state: any = { deleting: false, headOnly: false };
    const chain: any = {
      select: vi.fn((_cols?: any, opts?: any) => {
        state.headOnly = !!opts?.head;
        return chain;
      }),
      delete: vi.fn((_opts?: any) => {
        state.deleting = true;
        return chain;
      }),
      eq: vi.fn(() => chain),
      lt: vi.fn(() => {
        // Resolve on `lt` because our real code awaits after `.lt(...)`.
        return {
          then: (resolve: any) =>
            resolve(responseQueue.shift() ?? { count: 0, data: [], error: null }),
        };
      }),
      // For the load-policies path we await after `.eq('active', true)`
      // (no `lt`), so eq itself must be awaitable in that codepath.
    };
    // Make eq awaitable to satisfy loadActivePolicies().
    chain.eq = vi.fn(() => ({
      then: (resolve: any) =>
        resolve(responseQueue.shift() ?? { data: [], error: null }),
      // fall through to lt if a subsequent lt is chained after eq
      lt: chain.lt,
      select: chain.select,
    }));
    return chain;
  };

  return {
    from: vi.fn((table: string) => {
      fromCalls.push(table);
      return makeChain();
    }),
    __respondWith: (r: any) => responseQueue.push(r),
    __fromCalls: fromCalls,
  };
}

const adminMock = buildAdminMock();

vi.mock("@/lib/insforge-server", () => ({
  getInsforgeAdminClient: () => ({ database: adminMock }),
}));

vi.mock("@/lib/observability", () => ({
  reportError: vi.fn(async () => undefined),
  logInfo: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  writeAuditEntry: vi.fn(async () => undefined),
  AUDIT_EVENT: { ADMIN_RETENTION_ENFORCED: "admin.retention_enforced" },
}));

import { enforceRetentionPolicies } from "@/lib/data-retention";
import { writeAuditEntry } from "@/lib/audit-log";

describe("data-retention", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    adminMock.__fromCalls.length = 0;
    (writeAuditEntry as any).mockClear?.();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("is disabled by default (env flag unset)", async () => {
    delete process.env.DATA_RETENTION_ENABLED;
    const result = await enforceRetentionPolicies();
    expect(result.enabled).toBe(false);
    expect(result.totalDeleted).toBe(0);
    expect(result.results).toHaveLength(0);
    // Should not have hit the DB at all.
    expect(adminMock.__fromCalls).toHaveLength(0);
  });

  it("respects forceEnabled override even when env flag is off", async () => {
    delete process.env.DATA_RETENTION_ENABLED;
    // 1st response = active policies list; then per-table responses.
    adminMock.__respondWith({
      data: [
        {
          id: "p1",
          table_name: "replied_comments",
          timestamp_col: "replied_at",
          retention_days: 30,
          description: null,
          active: true,
        },
      ],
      error: null,
    });
    adminMock.__respondWith({ count: 7, error: null }); // dryRun count

    const result = await enforceRetentionPolicies({ forceEnabled: true, dryRun: true });
    expect(result.enabled).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].deletedCount).toBe(7);
  });

  it("skips tables that are not in the allowlist", async () => {
    process.env.DATA_RETENTION_ENABLED = "true";
    adminMock.__respondWith({
      data: [
        {
          id: "p2",
          table_name: "arbitrary_table_name",
          timestamp_col: "created_at",
          retention_days: 30,
          description: null,
          active: true,
        },
      ],
      error: null,
    });
    const result = await enforceRetentionPolicies({ dryRun: false });
    expect(result.results[0].skipped).toBe(true);
    expect(result.results[0].skipReason).toContain("allowlist");
  });

  it("skips policies with an invalid timestamp column name", async () => {
    process.env.DATA_RETENTION_ENABLED = "true";
    adminMock.__respondWith({
      data: [
        {
          id: "p3",
          table_name: "audit_logs",
          timestamp_col: "created_at; DROP TABLE users",
          retention_days: 30,
          active: true,
        },
      ],
      error: null,
    });
    const result = await enforceRetentionPolicies();
    expect(result.results[0].skipped).toBe(true);
    expect(result.results[0].skipReason).toContain("timestamp");
  });

  it("skips policies with retention_days <= 0", async () => {
    process.env.DATA_RETENTION_ENABLED = "true";
    adminMock.__respondWith({
      data: [
        {
          id: "p4",
          table_name: "audit_logs",
          timestamp_col: "created_at",
          retention_days: 0,
          active: true,
        },
      ],
      error: null,
    });
    const result = await enforceRetentionPolicies();
    expect(result.results[0].skipped).toBe(true);
    expect(result.results[0].skipReason).toContain("> 0");
  });

  it("executes a real DELETE and reports the deleted count", async () => {
    process.env.DATA_RETENTION_ENABLED = "true";
    adminMock.__respondWith({
      data: [
        {
          id: "p5",
          table_name: "replied_comments",
          timestamp_col: "replied_at",
          retention_days: 30,
          active: true,
        },
      ],
      error: null,
    });
    adminMock.__respondWith({ count: 42, error: null });

    const result = await enforceRetentionPolicies({ dryRun: false });
    expect(result.dryRun).toBe(false);
    expect(result.totalDeleted).toBe(42);
    expect(result.results[0].deletedCount).toBe(42);
    expect(writeAuditEntry).toHaveBeenCalledTimes(1);
  });

  it("captures DB errors as skipped results and does NOT throw", async () => {
    process.env.DATA_RETENTION_ENABLED = "true";
    adminMock.__respondWith({
      data: [
        {
          id: "p6",
          table_name: "audit_logs",
          timestamp_col: "created_at",
          retention_days: 2190,
          active: true,
        },
      ],
      error: null,
    });
    adminMock.__respondWith({ count: null, error: { message: "permission denied" } });

    const result = await enforceRetentionPolicies();
    expect(result.results[0].skipped).toBe(true);
    expect(result.results[0].error).toContain("permission denied");
  });
});
