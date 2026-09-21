"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Lightbulb, Clapperboard, Menu, Plus } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import CreatePostDialog from "@/components/schedule/create-post-dialog";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const navItems = [
    {
      name: "Schedule",
      href: "/schedule",
      icon: Calendar,
      isActive: pathname.startsWith("/schedule"),
    },
    {
      name: "Ideas",
      href: "/ideas",
      icon: Lightbulb,
      isActive: pathname.startsWith("/ideas"),
    },
  ];

  const rightItems = [
    {
      name: "Studio",
      href: "/studio",
      icon: Clapperboard,
      isActive: pathname.startsWith("/studio"),
    },
  ];

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/80 px-2 py-1 shadow-lg"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Left items: Schedule, Ideas */}
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "min-h-[44px] min-w-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-1 transition-colors",
                  item.isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="text-[11px] leading-tight tracking-tight">{item.name}</span>
              </Link>
            );
          })}

          {/* Center Action: Prominent + Post FAB */}
          <div className="flex items-center justify-center px-1">
            <button
              onClick={() => setIsCreateOpen(true)}
              aria-label="Create New Post"
              className="min-h-[44px] min-w-[44px] size-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform"
            >
              <Plus className="size-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Right items: Studio */}
          {rightItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "min-h-[44px] min-w-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-1 transition-colors",
                  item.isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="text-[11px] leading-tight tracking-tight">{item.name}</span>
              </Link>
            );
          })}

          {/* Menu / Drawer Toggle */}
          <button
            onClick={toggleSidebar}
            aria-label="Open Navigation Menu"
            className="min-h-[44px] min-w-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="size-5 shrink-0" />
            <span className="text-[11px] leading-tight tracking-tight">Menu</span>
          </button>
        </div>
      </nav>

      <CreatePostDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  );
}

export default MobileBottomNav;
