import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy",                  // Public privacy policy page
  "/terms",                    // Public terms of service page
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",           // Public liveness / readiness probe for uptime monitors
  "/api/chat/(.*)",            // Public website embed chat
  "/api/webhooks/(.*)",        // Meta, WhatsApp, Calcom, Clerk, Voice webhooks
  "/api/social/webhook(.*)",   // Instagram/Facebook comment webhook (Meta pushes here)
  "/api/social/whatsapp(.*)",  // WhatsApp Cloud API webhook
  "/api/chatbot(.*)",          // Public website chatbot widget
  "/api/lead-form/(.*)",       // Public embeddable lead capture form APIs
  "/lead-form(.*)",            // Public lead capture & booking form page (for Instagram/FB leads)
  "/api/social/cron-comments(.*)", // Autonomous 1-minute fallback cron for comment auto-replies
  "/api/inngest(.*)",          // Inngest background job runner
]);


// The onboarding page itself (authenticated but skip the onboarding check)
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

// API routes — skip the onboarding check, they handle auth themselves
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    // ─── Correlation ID ────────────────────────────────────────────────────
    // Read an incoming X-Correlation-Id (from an upstream proxy or a client
    // that wants to trace) OR generate a fresh UUID. Attach it to the
    // request headers so route handlers can pick it up via next/headers,
    // and echo it back on the response for the caller to see.
    const incoming = req.headers.get("x-correlation-id");
    const correlationId =
      incoming && /^[a-zA-Z0-9._-]{8,128}$/.test(incoming)
        ? incoming
        : crypto.randomUUID();

    // Helper: return NextResponse.next() (or a redirect / json) with the
    // correlation id on both request and response headers.
    const withCorrelation = (response: NextResponse): NextResponse => {
      response.headers.set("x-correlation-id", correlationId);
      return response;
    };

    // Every downstream response gets the correlation id header. To make sure
    // `next/headers` inside route handlers can see it too, we forward it as a
    // request header via NextResponse.next({ request }).
    const forwardHeaders = new Headers(req.headers);
    forwardHeaders.set("x-correlation-id", correlationId);

    const nextWithHeaders = () =>
      withCorrelation(NextResponse.next({ request: { headers: forwardHeaders } }));

    try {
      const { userId } = await auth();

      // 1. Unauthenticated users:
      if (!userId) {
        // Allow explicitly public routes (public pages + public API endpoints).
        if (isPublicRoute(req)) {
          return nextWithHeaders();
        }

        // Non-public API routes: reject at the edge with JSON 401 as
        // defense-in-depth. Individual handlers still enforce auth, but this
        // guarantees a forgotten in-handler guard cannot leak data.
        if (isApiRoute(req)) {
          return withCorrelation(
            NextResponse.json({ error: "Unauthorized" }, { status: 401 })
          );
        }

        // Redirect private dashboard routes to sign-in
        const signInUrl = new URL("/sign-in", req.url);
        signInUrl.searchParams.set("redirect_url", req.url);
        return withCorrelation(NextResponse.redirect(signInUrl));
      }

      // 2. Authenticated users:
      // Allow API routes and the onboarding page itself to load without redirect loops
      if (isApiRoute(req) || isOnboardingRoute(req)) {
        return nextWithHeaders();
      }

      // If authenticated user visits landing page "/", redirect to their workspace
      if (req.nextUrl.pathname === "/") {
        const workspaceUrl = new URL("/schedule", req.url);
        return withCorrelation(NextResponse.redirect(workspaceUrl));
      }

      return nextWithHeaders();
    } catch (err) {
      console.error("[proxy] Middleware caught exception:", err);
      // Fail open for public routes so landing, terms, privacy, health never 500
      if (isPublicRoute(req)) {
        return nextWithHeaders();
      }
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return withCorrelation(NextResponse.redirect(signInUrl));
    }
  },
  {
    clockSkewInMs: 120 * 1000, // 2 minutes clock tolerance to absorb PC time drift and prevent "token-iat-in-the-future"
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov|ogg|mp3|wav)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
