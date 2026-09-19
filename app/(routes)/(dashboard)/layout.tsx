import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "./_common/app-sidebar";
import { ScheduledPostsPoller } from "@/components/schedule/scheduled-posts-poller";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import Logo from "@/components/logo";

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
        {/* 3. Top Bar with Mobile Hamburger Trigger (min 44x44px target) */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-3 sm:px-6 bg-background/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="min-h-[44px] min-w-[44px] size-11 flex items-center justify-center -ml-2 rounded-lg hover:bg-muted text-foreground transition-colors" />
            <div className="flex items-center gap-2">
              <Logo hideName={false} className="scale-90 origin-left" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">AI Workspace</span>
              <span className="sm:hidden">Active</span>
            </span>
          </div>
        </header>

        {/* 4. Main Page Content Container with mobile bottom nav clearance */}
        <main className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6 pb-20 md:pb-6 flex flex-col">
          {children}
        </main>

        {/* 5. Mobile Bottom Navigation Bar (Visible only on mobile < md) */}
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}