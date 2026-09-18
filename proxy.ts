import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy",                  // Public privacy policy page
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/chat/(.*)",            // Public website embed chat
  "/api/webhooks/(.*)",        // Meta, WhatsApp, Calcom, Clerk, Voice webhooks
  "/api/social/webhook(.*)",   // Instagram/Facebook comment webhook (Meta pushes here)
  "/api/social/whatsapp(.*)",  // WhatsApp Cloud API webhook
  "/api/chatbot(.*)",          // Public website chatbot widget
  "/api/lead-form/(.*)",       // Public embeddable lead capture form
  "/api/inngest(.*)",          // Inngest background job runner
]);


// The onboarding page itself (authenticated but skip the onboarding check)
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

// API routes — skip the onboarding check, they handle auth themselves
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    const { userId } = await auth();

    // 1. Unauthenticated users:
    if (!userId) {
      // Allow explicitly public routes (public pages + public API endpoints).
      if (isPublicRoute(req)) {
        return NextResponse.next();
      }

      // Non-public API routes: reject at the edge with JSON 401 as
      // defense-in-depth. Individual handlers still enforce auth, but this
      // guarantees a forgotten in-handler guard cannot leak data.
      if (isApiRoute(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Redirect private dashboard routes to sign-in
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }

    // 2. Authenticated users:
    // Allow API routes and the onboarding page itself to load without redirect loops
    if (isApiRoute(req) || isOnboardingRoute(req)) {
      return NextResponse.next();
    }

    // If authenticated user visits landing page "/", redirect to their workspace
    if (req.nextUrl.pathname === "/") {
      const workspaceUrl = new URL("/schedule", req.url);
      return NextResponse.redirect(workspaceUrl);
    }

    return NextResponse.next();
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
