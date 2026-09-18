import { createHash } from "crypto";

/**
 * PII Redactor — a defense-in-depth helper that strips personally identifiable
 * information (PII) and secrets from any value before it hits logs, telemetry,
 * or third-party sinks (Sentry, Datadog, etc.).
 *
 * The redactor is deliberately pessimistic: it prefers false positives over
 * false negatives. When in doubt, mask.
 *
 * Coverage:
 *   • Email addresses            — `alice@example.com` → `[EMAIL]`
 *   • Phone numbers (E.164 & local)                     → `[PHONE]`
 *   • Credit-card-like 13–19 digit sequences            → `[CARD]`
 *   • JWT tokens (three base64url segments)             → `[JWT]`
 *   • Bearer tokens                                     → `Bearer [REDACTED]`
 *   • OpenAI / Groq / GitHub / AWS / Stripe / Slack API keys → `[API_KEY]`
 *   • IPv4 & IPv6 addresses                             → `[IP]`
 *   • Sensitive object keys (password, token, secret,
 *     apiKey, authorization, cookie, ssn, aadhaar, pan) → `[REDACTED]`
 *
 * Public API:
 *   redactPII(value)      — deep-redacts any value (string, array, object).
 *   redactString(str)     — redacts a single string.
 *   hashIP(ip)            — one-way SHA-256 prefix; use for audit logs.
 */

// ---------------------------------------------------------------------------
// Regex library
// ---------------------------------------------------------------------------

// Email: RFC-lite. Covers all realistic addresses without pathological cases.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone: matches three well-known formats with an outer boundary that rejects
// timestamps, URLs, and short numeric IDs:
//   1. International E.164 with country code: "+91 98765 43210", "+44 20 7946 0000"
//   2. North-American parenthesized/dashed:   "(415) 555-1234", "415-555-1234"
//   3. Indian 10-digit mobile:                "9876543210", "98765 43210"
// Anchored with lookbehind/lookahead so it never eats digits that are part of
// dates ("2024-01-15"), file paths, or URL segments.
const PHONE_RE =
  /(?<![\w\/:\-])(?:\+\d{1,3}[ .-]?\d{2,5}(?:[ .-]?\d{2,5}){1,2}|\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}|[6-9]\d{4}[ .-]?\d{5})(?!\w)/g;

// Credit card: 13–19 digits with optional spaces/dashes. Not Luhn-validated —
// this is a redactor, not a validator. False positives are acceptable.
const CARD_RE = /(?:\d[ -]?){13,19}/g;

// JWT: three base64url segments separated by dots (header.payload.signature).
const JWT_RE = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;

// Bearer tokens in Authorization headers or free text.
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{6,}\b/gi;

// Provider API keys — well-known prefixes.
// The character class intentionally accepts hyphens and underscores so that
// modern hierarchical key formats (e.g. `sk-proj-...`, `github_pat_...`) match
// in full and are not sliced through by the PHONE regex.
const API_KEY_RE = new RegExp(
  [
    "sk-[A-Za-z0-9_-]{20,}",                 // OpenAI, Groq (incl. sk-proj-*)
    "gsk_[A-Za-z0-9_-]{20,}",                // Groq
    "pk_(?:live|test)_[A-Za-z0-9]{16,}",     // Stripe publishable
    "sk_(?:live|test)_[A-Za-z0-9]{16,}",     // Stripe secret
    "rk_(?:live|test)_[A-Za-z0-9]{16,}",     // Stripe restricted
    "ghp_[A-Za-z0-9]{20,}",                  // GitHub personal
    "ghs_[A-Za-z0-9]{20,}",                  // GitHub server
    "github_pat_[A-Za-z0-9_]{20,}",
    "xox[abpors]-[A-Za-z0-9-]{10,}",         // Slack
    "whsec_[A-Za-z0-9]{20,}",                // Clerk / Stripe webhook
    "AKIA[0-9A-Z]{16}",                      // AWS access key
    "ASIA[0-9A-Z]{16}",                      // AWS session key
    "AIza[0-9A-Za-z_-]{30,}",                // Google API key
  ].join("|"),
  "g"
);

// IPv4
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

// IPv6 (compact form).
const IPV6_RE = /\b(?:[a-fA-F0-9]{1,4}:){2,7}[a-fA-F0-9]{1,4}\b/g;

// Object keys whose value must ALWAYS be redacted regardless of type.
// Two categories:
//   • Secrets/credentials  — the value must never touch logs at all.
//   • Direct-identifier PII — email/phone/name/address; redact at key level so
//     a serializer that stringifies before regex-scrubbing can't leak them.
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  // ── Credentials & secrets ──────────────────────────────────────────────
  /password/i,
  /passwd/i,
  /^token$/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /id[_-]?token/i,
  /^secret$/i,
  /client[_-]?secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /session/i,
  /private[_-]?key/i,
  /encryption[_-]?key/i,
  // ── Direct-identifier PII ──────────────────────────────────────────────
  /^email$/i,
  /email[_-]?address/i,
  /^phone$/i,
  /phone[_-]?number/i,
  /^mobile$/i,
  /^first[_-]?name$/i,
  /^last[_-]?name$/i,
  /^full[_-]?name$/i,
  /^address$/i,
  /street[_-]?address/i,
  /postal[_-]?code/i,
  /^zip$/i,
  // ── Regulated national IDs ─────────────────────────────────────────────
  /^ssn$/i,
  /aadhaar/i,
  /^pan$/i,
  // ── Payment ────────────────────────────────────────────────────────────
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /^otp$/i,
];

// ---------------------------------------------------------------------------
// String-level redaction
// ---------------------------------------------------------------------------

export function redactString(input: string): string {
  if (typeof input !== "string" || input.length === 0) return input;

  let out = input;

  // Order matters — mask longer / more specific patterns first so that a
  // credit-card regex doesn't eat digits inside a phone number, etc.
  out = out.replace(JWT_RE, "[JWT]");
  out = out.replace(BEARER_RE, "Bearer [REDACTED]");
  out = out.replace(API_KEY_RE, "[API_KEY]");
  out = out.replace(EMAIL_RE, "[EMAIL]");
  out = out.replace(CARD_RE, (m) => {
    // Only mask if the raw match has 13–19 digits after stripping separators.
    const digits = m.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return m;
    return "[CARD]";
  });
  out = out.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return m;
    return "[PHONE]";
  });
  out = out.replace(IPV6_RE, "[IP]");
  out = out.replace(IPV4_RE, (m) => {
    // Preserve loopback / private-range hints since they're not PII and
    // are actually useful signal in logs.
    if (m === "127.0.0.1" || m === "0.0.0.0") return m;
    return "[IP]";
  });

  return out;
}

// ---------------------------------------------------------------------------
// Deep redaction
// ---------------------------------------------------------------------------

function isSensitiveKey(key: string): boolean {
  if (!key) return false;
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

/**
 * Deeply redacts any value.
 *
 * • Strings → regex-scrubbed.
 * • Arrays  → each element redacted.
 * • Objects → keys inspected; sensitive keys forced to `[REDACTED]`, other
 *             values recursed into.
 * • Errors  → message/stack redacted, prototype preserved.
 *
 * A max depth guard prevents infinite loops on cyclic structures.
 */
export function redactPII<T>(value: T, maxDepth = 8): T {
  return _redact(value, maxDepth, new WeakSet()) as T;
}

function _redact(value: unknown, depthLeft: number, seen: WeakSet<object>): unknown {
  if (depthLeft <= 0) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "string") return redactString(value as string);
  if (t === "number" || t === "boolean" || t === "bigint") return value;
  if (t === "function") return "[Function]";
  if (t === "symbol") return String(value);

  if (value instanceof Error) {
    const redactedMsg = redactString(value.message);
    const clone = new (value.constructor as ErrorConstructor)(redactedMsg);
    if (value.stack) clone.stack = redactString(value.stack);
    return clone;
  }

  if (value instanceof Date) return value;

  if (Array.isArray(value)) {
    return value.map((v) => _redact(v, depthLeft - 1, seen));
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (isSensitiveKey(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = _redact(v, depthLeft - 1, seen);
      }
    }
    return out;
  }

  return value;
}

// ---------------------------------------------------------------------------
// IP hashing (for audit logs)
// ---------------------------------------------------------------------------

/**
 * One-way SHA-256 hash of an IP address, truncated to 16 hex chars.
 *
 * We NEVER store raw IPs in the audit_logs table — this yields a stable
 * anonymous identifier for security-forensic pattern matching (e.g. "same
 * source hit these 5 accounts") without adding PII to our retention footprint.
 *
 * The optional `salt` argument lets you rotate the hash space when needed;
 * default is a stable hostname-scoped salt.
 */
export function hashIP(ip: string | null | undefined, salt = "lemon-ai"): string | null {
  if (!ip || typeof ip !== "string") return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  return createHash("sha256")
    .update(`${salt}:${trimmed}`)
    .digest("hex")
    .slice(0, 16);
}
