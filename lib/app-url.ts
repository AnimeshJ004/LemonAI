import { NextRequest } from "next/server";

function isLocalhost(urlOrHost?: string | null): boolean {
  if (!urlOrHost) return false;
  return (
    urlOrHost.includes("localhost") ||
    urlOrHost.includes("127.0.0.1") ||
    urlOrHost.includes("0.0.0.0") ||
    urlOrHost.includes("[::1]")
  );
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Robust domain resolver for local dev, Vercel deployments, custom domains, and reverse proxies.
 * Prioritizes:
 * 1. Live request headers (x-forwarded-host, host, nextUrl) if provided
 * 2. Explicitly configured NEXT_PUBLIC_APP_URL or APP_URL (if NOT pointing to localhost)
 * 3. Automatic hosting platform domains (Vercel production URL, Vercel deployment URL, Railway, Render)
 * 4. NEXT_PUBLIC_APP_URL / APP_URL fallback (even if localhost in dev)
 * 5. Default http://localhost:3000
 */
export function getAppUrl(request?: NextRequest | Request | null): string {
  if (request) {
    // 1. Check for standard proxy headers (Vercel, Cloudflare, AWS, etc.)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      const primaryHost = forwardedHost.split(",")[0].trim();
      if (primaryHost) {
        return normalizeUrl(`${forwardedProto}://${primaryHost}`);
      }
    }

    // 2. Check standard host header
    const host = request.headers.get("host");
    if (host) {
      const isLocal = isLocalhost(host);
      const proto = isLocal ? "http" : (request.headers.get("x-forwarded-proto") || "https");
      return normalizeUrl(`${proto}://${host}`);
    }

    // 3. Fallback to request.nextUrl.origin or request.url
    if ("nextUrl" in request && request.nextUrl?.origin && request.nextUrl.origin !== "null") {
      return normalizeUrl(request.nextUrl.origin);
    }
    if (request.url) {
      try {
        const parsed = new URL(request.url);
        if (parsed.origin && parsed.origin !== "null") {
          return normalizeUrl(parsed.origin);
        }
      } catch {}
    }
  }

  // Check NEXT_PUBLIC_APP_URL or APP_URL if they contain a REAL production domain (not localhost)
  const envAppUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  if (envAppUrl && !isLocalhost(envAppUrl)) {
    return normalizeUrl(envAppUrl);
  }

  // Automatic platform deployment URLs (Vercel, Railway, Render, etc.)
  // On Vercel, VERCEL_PROJECT_PRODUCTION_URL is the canonical production domain (e.g. app.example.com or lemonai.vercel.app)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  if (process.env.VERCEL_URL) {
    return normalizeUrl(process.env.VERCEL_URL);
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return normalizeUrl(process.env.NEXT_PUBLIC_VERCEL_URL);
  }
  if (process.env.VERCEL_BRANCH_URL) {
    return normalizeUrl(process.env.VERCEL_BRANCH_URL);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return normalizeUrl(process.env.RAILWAY_PUBLIC_DOMAIN);
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return normalizeUrl(process.env.RENDER_EXTERNAL_URL);
  }

  // Fallback to environment variable (even if localhost in local dev)
  if (envAppUrl) {
    return normalizeUrl(envAppUrl);
  }

  return "http://localhost:3000";
}
