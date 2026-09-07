import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth/(.*)",
]);

// The onboarding page itself (authenticated but skip the onboarding check)
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

// API routes — skip the onboarding check, they handle auth themselves
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Public routes — no auth required
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // API routes and the onboarding page itself — allow through
  if (isApiRoute(req) || isOnboardingRoute(req)) {
    return NextResponse.next();
  }

  // For all authenticated dashboard routes:
  // Check if the user has completed onboarding using a lightweight cookie-based approach.
  // The onboarding completion is stored in a cookie set when the user finishes, avoiding
  // any DB call in middleware (which is slow and has no native DB client access).
  const onboardingCookie = req.cookies.get("lemon_ai_onboarded");

  if (!onboardingCookie?.value) {
    // No cookie — redirect to onboarding to check
    const onboardingUrl = new URL("/onboarding", req.url);
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
