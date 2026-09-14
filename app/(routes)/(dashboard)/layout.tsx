import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "./_common/app-sidebar";
import { ScheduledPostsPoller } from "@/components/schedule/scheduled-posts-poller";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* 1. Background Poller for Scheduled Posts */}
      <ScheduledPostsPoller />

      {/* 2. Mobile & Desktop App Sidebar */}
      <AppSidebar />

      <SidebarInset className="min-w-0 max-w-full flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 3. Top Bar with Mobile Hamburger Trigger */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            Lemon.ai
          </div>
        </header>

        {/* 4. Main Page Content Container */}
        <div className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 flex flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}