import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
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

  return <OnboardingWizard />;
}
