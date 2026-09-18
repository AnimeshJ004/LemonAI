import { NextResponse } from "next/server";

/**
 * Validates that no string field in a body object exceeds the specified max length.
 * Returns a 400 NextResponse if any field is too long, or null if all fields are valid.
 *
 * Usage:
 *   const invalid = validateInputLengths(body, { topic: 500, keyword: 200 });
 *   if (invalid) return invalid;
 */
export function validateInputLengths(
  body: Record<string, unknown>,
  limits: Record<string, number>
): NextResponse | null {
  const violations: string[] = [];
  for (const [field, maxLen] of Object.entries(limits)) {
    const value = body[field];
    if (typeof value === "string" && value.length > maxLen) {
      violations.push(`${field} (max ${maxLen} chars)`);
    }
  }
  if (violations.length > 0) {
    return NextResponse.json(
      {
        error: `Input too long. The following fields exceed their limits: ${violations.join(", ")}.`,
      },
      { status: 400 }
    );
  }
  return null;
}

/**
 * Default AI text input limits (characters).
 * Apply these to any AI route that accepts freeform text to cap LLM token spend.
 */
export const AI_INPUT_LIMITS = {
  topic: 500,
  keyword: 200,
  niche: 300,
  targetAudience: 300,
  businessName: 200,
  country: 100,
  prompt: 2000,
  content: 5000,
  description: 1000,
  competitorSampleText: 2000,
  script: 3000,
  title: 300,
  outline: 3000,
  goal: 200,
  productOffer: 500,
  brandTone: 200,
  mainOffer: 500,
} as const;
