import { ModernLoader } from "@/components/ui/modern-loader";

export default function DashboardLoading() {
  return (
    <ModernLoader
      showSkeleton={true}
      label="Loading view"
      description="Synchronizing workspace assets and data"
    />
  );
}
