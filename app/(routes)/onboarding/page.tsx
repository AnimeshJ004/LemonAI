import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getInsforgeAdminClient } from "@/lib/insforge-server";
import OnboardingWizard from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Welcome to Lemon AI | Set Up Your Brand",
  description:
    "Answer a few questions about your business so Lemon AI can generate perfectly branded social media content from day one.",
};

export default async function OnboardingPage() {
  const { userId } = await auth();

  // Unauthenticated users shouldn't reach here (middleware handles it)
  if (!userId) {
    redirect("/sign-in");
  }

  // If the user already has a completed brand profile in the database, skip onboarding
  let alreadyDone = false;
  try {
    const admin = getInsforgeAdminClient();
    const { data: profile } = await admin.database
      .from("brand_profiles")
      .select("onboarding_completed, business_name")
      .eq("user_id", userId)
      .maybeSingle();

    alreadyDone = Boolean(
      profile?.onboarding_completed || profile?.business_name?.trim()
    );
  } catch (err) {
    console.warn("DB check for onboarding profile error (letting user complete onboarding):", err);
  }

  if (alreadyDone) {
    // Delegate to route handler which has permission to set cookies and redirect to /schedule
    redirect("/api/onboarding?redirect=/schedule");
  }

  return <OnboardingWizard />;
}
