import { z, ZodError, ZodSchema } from "zod";
import { NextResponse } from "next/server";

/**
 * Zod validation helpers for API route handlers.
 *
 * Two patterns are supported:
 *
 *   1. `parseBody(req, schema)` — parse and validate the request body in one
 *      call. Returns either the typed data OR a structured `NextResponse`
 *      containing a 400 with a per-field error list. Zero exceptions bubble.
 *
 *   2. Direct use of the shared schemas (Email, Phone, Url, ConsentType, …)
 *      composed into route-specific schemas.
 *
 * All error responses omit the offending value — only field names + reason
 * codes leave the boundary, so a malformed request never leaks the raw
 * attacker payload back into logs.
 */

// ---------------------------------------------------------------------------
// Shared primitive schemas
// ---------------------------------------------------------------------------

/**
 * Email — loose RFC-lite match. Zod's built-in `.email()` is stricter than
 * some real-world inputs (e.g. gmail dots), so we use a pattern that matches
 * anything with an `@` and a TLD.
 */
export const Email = z
  .string()
  .trim()
  .min(3)
  .max(320) // RFC 5321 max local(64) + '@' + domain(255)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address");

/**
 * Phone — E.164 or common national formats. We tolerate `+`, digits, spaces,
 * dashes, dots, parentheses. Enforced digit count 7–15 to reject obviously
 * bogus inputs.
 */
export const Phone = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .transform((s) => s.replace(/[^\d+]/g, ""))
  .refine(
    (s) => {
      const digits = s.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    },
    { message: "Phone number must be 7–15 digits" }
  );

/** URL that must start with http(s):// */
export const Url = z
  .string()
  .trim()
  .url({ message: "Must be a valid URL" })
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "URL must use http or https",
  });

export const ConsentType = z.enum([
  "terms_of_service",
  "privacy_policy",
  "marketing_emails",
  "analytics_cookies",
  "ai_training",
  "data_processing",
  "third_party_sharing",
]);

export const LeadStageSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "booked",
  "proposal",
  "closed_won",
  "closed_lost",
]);

export const ChannelTypeSchema = z.enum([
  "TWITTER",
  "LINKEDIN",
  "INSTAGRAM",
  "THREADS",
  "FACEBOOK",
  "BLUESKY",
  "YOUTUBE",
]);

/**
 * Short free text — hard-caps common freeform fields at 500 chars to prevent
 * runaway LLM cost from an unbounded prompt injection.
 */
export const ShortText = z.string().trim().max(500);

/** Medium free text — post captions, bios, product descriptions. */
export const MediumText = z.string().trim().max(3000);

/** Long free text — blog bodies, transcripts. Still hard-capped. */
export const LongText = z.string().trim().max(20_000);

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export interface ParsedBody<T> {
  data: T | null;
  errorResponse: NextResponse | null;
}

/**
 * Reads a JSON body from a Fetch-style request, parses it with the given
 * schema, and returns either `{ data }` or `{ errorResponse }` — never both,
 * never throws.
 *
 * Usage in a route handler:
 *
 *   const { data, errorResponse } = await parseBody(req, MySchema);
 *   if (errorResponse) return errorResponse;
 *   // data is fully typed here
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      data: null,
      errorResponse: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      data: null,
      errorResponse: buildErrorResponse(result.error),
    };
  }
  return { data: result.data, errorResponse: null };
}

/**
 * Parses a body that was already read (e.g. after signature verification of a
 * webhook where the raw string is needed first).
 */
export function parseJson<T>(
  raw: unknown,
  schema: ZodSchema<T>
): ParsedBody<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { data: null, errorResponse: buildErrorResponse(result.error) };
  }
  return { data: result.data, errorResponse: null };
}

/**
 * Builds a 400 response with field-level errors. NEVER includes the offending
 * value — only field paths and Zod error codes leave the boundary.
 */
function buildErrorResponse(error: ZodError): NextResponse {
  const issues = error.issues.map((iss) => ({
    field: iss.path.join(".") || "(root)",
    code: iss.code,
    message: iss.message,
  }));
  return NextResponse.json(
    { error: "Validation failed", issues },
    { status: 400 }
  );
}
