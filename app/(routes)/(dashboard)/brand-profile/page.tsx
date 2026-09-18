import { Metadata } from "next";
import { BrandProfileView } from "@/components/brand/brand-profile-view";

export const metadata: Metadata = {
  title: "Brand Profile | Lemon AI",
  description:
    "Set up your business brand profile to power AI-generated social media content and scheduled posts.",
};

export default function BrandProfilePage() {
  return <BrandProfileView />;
}
