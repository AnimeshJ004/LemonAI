import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Lemon AI ESLint configuration.
 *
 * Philosophy: keep syntactic and correctness errors as HARD errors so CI can
 * block them on every PR, but downgrade the pre-existing type-hygiene debt
 * (~527 `any` usages inherited from the legacy code) to WARNINGS so we can
 * ratchet the codebase forward without blocking day-to-day work.
 *
 * Ratchet plan (tracked in CONTRIBUTING.md):
 *   • Phase 1 (now)   — `no-explicit-any` = warn, no new `any` in fresh code.
 *   • Phase 2         — enable `--max-warnings=0` on CI for a fixed allowlist
 *                       of hardened directories (lib/, tests/, new features).
 *   • Phase 3         — flip `no-explicit-any` to error globally after the
 *                       legacy hotspots (analytics/overview, direct-publisher,
 *                       auto-pilot, crm-service) have been retyped.
 *
 * The CI workflow (`.github/workflows/ci.yml`) runs `npm run lint` which
 * ignores warnings and fails only on errors — matching this configuration.
 */

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Repo-wide ratchet — downgrade legacy hygiene rules to warnings so CI can
  // stay green while we burn down the debt.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 3,
        },
      ],
      // React 19 Compiler ("react-hooks/*") introduces a new class of static
      // analysis errors that the legacy component tree pre-dates. Keep them
      // visible as warnings so new code is nudged toward compliance while
      // the legacy hotspots are refactored on their own schedule.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      // Cosmetic — unescaped entities are pre-existing and never a runtime
      // issue; JSX rendering handles them fine.
      "react/no-unescaped-entities": "warn",
      // Prevent new console.* calls in fresh code. Existing usages remain
      // as warnings and are being migrated to `lib/observability` (see
      // OPERATIONS.md and CONTRIBUTING.md).
      "no-console": ["warn", { allow: ["error"] }],
    },
  },

  // The observability library IS the console boundary — allow its internals.
  {
    files: ["lib/observability.ts", "instrumentation.ts", "scripts/**"],
    rules: {
      "no-console": "off",
    },
  },

  // Tests can be more permissive — they mock aggressively and often type as
  // `any` at the boundary. Still catches real errors, just no noise.
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone MJS scripts under scripts/ are node one-off tools that are
    // ESLint-noisy but out of the app's runtime path.
    "scripts/**",
    // Public JS assets are hand-authored embed scripts, not app code.
    "public/**",
  ]),
]);

export default eslintConfig;
