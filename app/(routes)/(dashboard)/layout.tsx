import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./_common/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-sidebar! border-none min-w-0 max-w-full overflow-hidden flex-1">
        <div className="m-1 rounded-lg border border-border dark:border-[#e0e1e11a] shadow-xs bg-background h-[calc(100vh-0.5rem)] min-w-0 max-w-full overflow-hidden flex flex-col">
          <div className="p-2 sm:p-4 flex-1 min-w-0 max-w-full overflow-y-auto">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}