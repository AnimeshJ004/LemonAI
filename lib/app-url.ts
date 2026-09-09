import { NextRequest } from "next/server";

/**
 * Robust domain resolver for local dev, Vercel deployments, custom domains, and reverse proxies.
 * Prioritizes x-forwarded-host / x-forwarded-proto headers to ensure exact domain match.
 */
export function getAppUrl(request?: NextRequest): string {
  if (request) {
    // 1. Check for standard proxy headers (Vercel, Cloudflare, etc.)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      // If forwardedHost contains multiple comma-separated hosts, take the first one
      const primaryHost = forwardedHost.split(",")[0].trim();
      return `${forwardedProto}://${primaryHost}`;
    }

    // 2. Check standard host header
    const host = request.headers.get("host");
    if (host) {
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      const proto = isLocal ? "http" : (request.headers.get("x-forwarded-proto") || "https");
      return `${proto}://${host}`;
    }

    // 3. Fallback to request.nextUrl.origin
    if (request.nextUrl?.origin && request.nextUrl.origin !== "null") {
      return request.nextUrl.origin;
    }
  }

  // Fallback to environment variable or localhost
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
