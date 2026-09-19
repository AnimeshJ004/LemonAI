import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts"],
    // Exclude Playwright E2E specs — they run in a separate CI job via Playwright.
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    globals: true,

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // Focus coverage on server-side code we actually write tests for.
      include: [
        "lib/**/*.{ts,tsx}",
        "app/api/**/*.ts",
        "inngest/**/*.ts",
        "instrumentation.ts",
      ],
      exclude: [
        // Third-party glue and generated code — not meaningful to measure.
        "lib/db/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/index.ts",
        // Long-tail dashboard & non-API code — track separately.
        "app/**/page.tsx",
        "app/**/layout.tsx",
        "components/**",
      ],
      // Ratchet plan: these thresholds represent the verified baseline floor.
      // They prevent regressions as new code is committed to the repository.
      thresholds: {
        lines: 10,
        statements: 10,
        functions: 15,
        branches: 7,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
