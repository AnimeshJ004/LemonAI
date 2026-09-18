import { Metadata } from "next";
import { StudioView } from "@/components/studio/studio-view";

export const metadata: Metadata = {
  title: "AI Content Studio | Lemon AI",
  description: "Create viral Reels, multi-slide Carousels, SEO Blogs, and Meta Ad Creatives powered by Groq AI.",
};

export default function StudioHubPage() {
  return <StudioView />;
}
