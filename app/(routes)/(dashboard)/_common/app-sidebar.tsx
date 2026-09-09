"use client"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Calendar, CreditCard, Lightbulb, Plus, PlusCircleIcon, Settings, Building2, Megaphone, Search, Clapperboard, LayoutTemplate, BookOpen, TrendingUp, Bot, Globe, MessageCircle, CalendarClock, Kanban, Inbox, BarChart3, Phone } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { getChannelIcon, getChannelUrl, getChannelProfileUrl } from '@/constants/channels';
import { ChannelType } from '@/types/channel.type';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { UserButton, useUser } from '@clerk/nextjs';
import ChannelAvatar from '@/components/channel-avatar';
import { toast } from 'sonner';
import { useState } from 'react';
import CreatePostDialog from '@/components/schedule/create-post-dialog';
import { Spinner } from '@/components/ui/spinner';

import { ConnectChannelDialog } from '@/components/settings/connect-channel-dialog';
import AutonomousCampaignDialog from '@/components/campaign/autonomous-campaign-dialog';
import { Sparkles } from 'lucide-react';

const mainNav = [
  { name: "Ideas", href: "/ideas", icon: Lightbulb },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Brand Profile", href: "/brand-profile", icon: Building2 },
  { name: "Meta Ads", href: "/meta-ads", icon: Megaphone },
  { name: "Social Automation", href: "/social-automation", icon: Bot },
  { name: "Website Bot", href: "/website-bot", icon: Globe },
  { name: "WhatsApp Bot", href: "/whatsapp-bot", icon: MessageCircle },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

// Member 1: Research nav
const researchNav = [
  { name: "Competition Research", href: "/competition-researcher", icon: Search },
];

// Member 1: Content Studio nav
const studioNav = [
  { name: "Reels Script", href: "/studio/reels", icon: Clapperboard },
  { name: "Carousel Creator", href: "/studio/carousels", icon: LayoutTemplate },
  { name: "Blog Writer", href: "/studio/blogs", icon: BookOpen },
  { name: "Ad Creatives", href: "/studio/ad-creatives", icon: Megaphone },
  { name: "Strategy Planner", href: "/studio/strategy", icon: TrendingUp },
];

// Member 3: CRM & Growth nav
const crmNav = [
  { name: "Pipeline", href: "/crm/pipeline", icon: Kanban },
  { name: "Inbox", href: "/crm/inbox", icon: Inbox },
  { name: "Appointments", href: "/appointments", icon: CalendarClock },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "AI Calling", href: "/ai-calling", icon: Phone },
];

const AppSidebar = () => {
  const pathname = usePathname();
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [isCreatePostOpen, setIsCreatePostOpen] = useState<boolean>(false)
  const [selectedChannelForConnect, setSelectedChannelForConnect] = useState<ChannelType | null>(null)
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState<boolean>(false)
  const [isAutonomousDialogOpen, setIsAutonomousDialogOpen] = useState<boolean>(false)

  const {data:channelsData, isPending} = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const res = await fetch("/api/channel");
      if (!res.ok) {
        throw new Error("Failed to fetch channels");
      }
      return res.json();
    }
  })
  
  const channels = (channelsData?.channels || []) as ChannelType[]
  const unconnectedChannels = channels.filter((channel: ChannelType) => !channel.connected);
  const connectedChannels = channels.filter((channel: ChannelType) => channel.connected);

  const connectedCount = channelsData?.connectedCount || 0;
  const totalChannels = channelsData?.totalChannels || 0;
  const limitedChannels = unconnectedChannels.slice(0, 4);

  const handleConnect = (channel: ChannelType) => {
    setSelectedChannelForConnect(channel)
    setIsConnectDialogOpen(true)
  }
 

  return (
    <>
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("p-4", isCollapsed && "p-2")}>
        <div className='flex items-center justify-between'>
           <Logo hideName={isCollapsed} />
           <SidebarTrigger className="hidden md:flex -mx-8 mb-0" />
        </div>
        <Button className='mt-4 w-full'
         size={isCollapsed ? "icon": "lg"}
         onClick={() => setIsCreatePostOpen(true)}
        >
            <Plus className="size-4" />
           {!isCollapsed && <span>New Post</span>}
        </Button>
        <Button
          variant="outline"
          className="mt-2 w-full border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors text-xs font-semibold"
          size={isCollapsed ? "icon" : "default"}
          onClick={() => setIsAutonomousDialogOpen(true)}
          title="Auto-Pilot Campaign"
        >
          <Sparkles className="size-3.5 text-primary shrink-0" />
          {!isCollapsed && <span>Auto-Pilot Campaign</span>}
        </Button>
      </SidebarHeader>
      <SidebarContent className={cn(!isCollapsed && "px-2")}>
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {mainNav.map((item) => (
                        <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton asChild
                            isActive={pathname === item.href}
                    tooltip={item.name}
                            >
                                <Link href={item.href}>
                                    <item.icon className="size-4" />
                                    <span className='text-sm'>{item.name}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>

        {/* Research Nav — Member 1 */}
        <SidebarGroup>
          <SidebarGroupLabel className='text-sm'>Research</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {researchNav.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild
                    isActive={pathname === item.href}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span className='text-sm'>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Content Studio Nav — Member 1 */}
        <SidebarGroup>
          <SidebarGroupLabel className='text-sm'>Content Studio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studioNav.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span className='text-sm'>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* CRM & Growth Nav — Member 3 */}
        <SidebarGroup>
          <SidebarGroupLabel className='text-sm'>CRM & Growth</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {crmNav.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild
                    isActive={pathname === item.href || (item.href !== "/crm" && pathname.startsWith(item.href))}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span className='text-sm'>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* {connected channels} */}
         {connectedChannels.length > 0 && (
         <SidebarGroup className={cn(isCollapsed && "px-1")}>
          <SidebarGroupLabel className='text-sm'>Channels</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
               {isPending ? (
                <div className='flex flex-col gap-2'>
                  <Skeleton className='h-8 w-full bg-secondary' />
                  <Skeleton className='h-8 w-full bg-secondary' />
                  <Skeleton className='h-8 w-full bg-secondary' />
                  <Skeleton className='h-8 w-full bg-secondary' />
                </div>
              ) : (
                connectedChannels?.map((channel: ChannelType) => {
                  const profileUrl = getChannelProfileUrl(channel.type, channel.handle)
                  return (
                    <SidebarMenuItem key={channel.id}>
                      <SidebarMenuButton
                        onClick={() => handleConnect(channel)}
                        className="w-full relative flex items-center gap-2 cursor-pointer hover:bg-muted/80 rounded-md"
                        tooltip={`Edit ${channel.name} (${channel.handle || ""})`}
                      >
                        <ChannelAvatar
                          size="sm"
                          className="w-full flex items-center gap-2"
                          type={channel.type}
                          color={channel.color}
                          profileImage={channel.profile_image}
                          name={!isCollapsed ? (channel.handle || channel.name) : ""}
                        />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
         </SidebarGroup>
         )}



        {/* {unconnected channels} */}
         <SidebarGroup className={cn(isCollapsed && "px-1")}>
          <SidebarGroupLabel className='text-sm'>Connect Channels</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isPending ? (
                <div className='flex flex-col gap-2'>
                  <Skeleton className='h-8 w-full bg-secondary' />
                  <Skeleton className='h-8 w-full bg-secondary' />
                  <Skeleton className='h-8 w-full bg-secondary' />
                  <Skeleton className='h-8 w-full bg-secondary' />
                </div>
              ) : (
                <>
                {limitedChannels.map((channel: ChannelType) => {
                  const icon = getChannelIcon(channel.type)
                  return (
                    <SidebarMenuItem key={channel.id}>
                      <SidebarMenuButton asChild
                       tooltip={`Connect ${channel.name}`}
                      >
                       <button
                        className='w-full flex items-center gap-2'
                        onClick={() => handleConnect(channel)}
                       >
                          <span>
                             <div className='relative'>
                              {icon ? (
                                <HugeiconsIcon icon={icon} color='currentColor'
                                className=" text-white! size-6! p-1 rounded-sm"
                                  style={{ background: channel.color}}
                                />
                              ) : null}

                              <div className={`absolute -right-1 bottom-0 p-0.5
                                 bg-white dark:bg-background rounded-xs
                                `}>
                                  <HugeiconsIcon icon={PlusSignIcon} className="size-2!" />
                                </div>
                             </div>
                          </span>
                          <span className='truncate'>
                            {channel.name}
                          </span>
                       </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Button asChild variant="ghost" className='w-full justify-start mt-1'>
                      <Link href="/settings" className='w-full flex items-center gap-2'>
                      <PlusCircleIcon className='size-4'  />
                      <span className='text-sm'>More channels</span>
                      </Link>
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
         </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
         <div className="mb-3 text-xs text-muted-foreground">
          <span>
            {connectedCount}/{totalChannels} channels connected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <UserButton
            showName={false}
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
          <span className="text-sm">{user?.fullName || user?.primaryEmailAddress?.emailAddress}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
    <CreatePostDialog
      open={isCreatePostOpen}
      onOpenChange={setIsCreatePostOpen}
    />
    <ConnectChannelDialog
      open={isConnectDialogOpen}
      onOpenChange={setIsConnectDialogOpen}
      channel={selectedChannelForConnect}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["channels"] })
      }}
    />
    <AutonomousCampaignDialog
      open={isAutonomousDialogOpen}
      onOpenChange={setIsAutonomousDialogOpen}
    />
    </>
  )
}

export default AppSidebar