import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth/(.*)",
  "/api/chat/(.*)",
  "/api/webhooks/(.*)",
  "/api/crm/(.*)",
  "/api/voice/(.*)",
  "/api/inngest(.*)",
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
      // Allow public routes
      if (isPublicRoute(req)) {
        return NextResponse.next();
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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
