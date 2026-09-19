import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAppUrl } from "@/lib/app-url";
import { NextRequest } from "next/server";

describe("getAppUrl resolver", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.RENDER_EXTERNAL_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("extracts domain from x-forwarded-host and x-forwarded-proto headers", () => {
    const req = new NextRequest("http://127.0.0.1:3000/api/webhooks/meta", {
      headers: {
        "x-forwarded-host": "lemonai-production.up.railway.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(getAppUrl(req)).toBe("https://lemonai-production.up.railway.app");
  });

  it("handles comma-separated x-forwarded-host from multi-tier proxies", () => {
    const req = new NextRequest("http://127.0.0.1:3000/api/social/webhook", {
      headers: {
        "x-forwarded-host": "app.seevora.com, cdn.cloudflare.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(getAppUrl(req)).toBe("https://app.seevora.com");
  });

  it("extracts domain from standard host header when non-local", () => {
    const req = new NextRequest("http://dummy/api/social/webhook", {
      headers: {
        host: "seevora.com",
      },
    });
    expect(getAppUrl(req)).toBe("https://seevora.com");
  });

  it("uses http protocol for localhost host headers in local dev", () => {
    const req = new NextRequest("http://localhost:3000/api/social/webhook", {
      headers: {
        host: "localhost:3000",
      },
    });
    expect(getAppUrl(req)).toBe("http://localhost:3000");
  });

  it("prioritizes NEXT_PUBLIC_APP_URL when set to a real production domain", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.lemonai.io/";
    expect(getAppUrl()).toBe("https://app.lemonai.io");
  });

  it("automatically falls back to VERCEL_PROJECT_PRODUCTION_URL when NEXT_PUBLIC_APP_URL is localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "lemonai.vercel.app";
    expect(getAppUrl()).toBe("https://lemonai.vercel.app");
  });

  it("automatically falls back to VERCEL_URL when NEXT_PUBLIC_APP_URL is localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "lemonai-preview.vercel.app";
    expect(getAppUrl()).toBe("https://lemonai-preview.vercel.app");
  });

  it("handles VERCEL_URL even if defined with https:// prefix", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "https://lemonai-preview.vercel.app/";
    expect(getAppUrl()).toBe("https://lemonai-preview.vercel.app");
  });

  it("automatically falls back to RAILWAY_PUBLIC_DOMAIN when NEXT_PUBLIC_APP_URL is localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.RAILWAY_PUBLIC_DOMAIN = "lemonai.up.railway.app";
    expect(getAppUrl()).toBe("https://lemonai.up.railway.app");
  });

  it("falls back to localhost:3000 in purely local environments with no deployment vars", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("falls back to default http://localhost:3000 when no env vars are set at all", () => {
    expect(getAppUrl()).toBe("http://localhost:3000");
  });
});
