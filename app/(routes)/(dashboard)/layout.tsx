import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/app/(routes)/(dashboard)/_common/app-sidebar" // Change path if different

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* 1. Mobile & Desktop App Sidebar */}
      <AppSidebar />

      <SidebarInset>
        {/* 2. Top Bar with Mobile Hamburger Trigger */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          {/* Ye button mobile (sm screens) par sidebar drawer ko toggle karega */}
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            Lemon.ai
          </div>
        </header>

        {/* 3. Main Page Content Container */}
        <main className="flex-1 overflow-x-hidden p-3 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}