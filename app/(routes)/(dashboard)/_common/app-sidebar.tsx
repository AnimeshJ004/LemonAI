"use client"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Calendar, CreditCard, Lightbulb, Plus, PlusCircleIcon, Settings } from 'lucide-react';
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

const mainNav = [
  { name: "Ideas", href: "/ideas", icon: Lightbulb },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

const AppSidebar = () => {
  const pathname = usePathname();
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [isCreatePostOpen, setIsCreatePostOpen] = useState<boolean>(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  const connectMutation = useMutation({
    mutationFn: async (channelTypeId: string) => {
      setConnectingId(channelTypeId)
      const res = await fetch("/api/channel/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelTypeId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect channel")
      }
      return data
    },
    onSuccess: (data) => {
      if (data.connected) {
        queryClient.invalidateQueries({ queryKey: ["channels"] })
        if (data.demo) {
          toast.success(`Connected demo ${data.channelType} account`)
        } else {
          toast.success(`Connected ${data.channelType || 'channel'} successfully`)
        }
        setConnectingId(null)
      } else if (data.url) {
        window.location.assign(data.url)
      }
    },
    onError: (err: any) => {
      setConnectingId(null)
      toast.error(err?.message || "Failed to connect channel")
    }
  })

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


  const handleConnect = (channelTypeId: string) => {
    if(connectMutation.isPending) return;
    connectMutation.mutate(channelTypeId);
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
                      <SidebarMenuButton asChild>
                       <a
                         href={profileUrl}
                         target="_blank" rel="noreferrer"
                          className="w-full! relative block items-center gap-2"
                       >
                           <ChannelAvatar
                            size="sm"
                           className="w-full flex items-center gap-2"
                            type={channel.type}
                            color={channel.color}
                            profileImage={channel.profile_image}
                            name={!isCollapsed ? (channel.handle || channel.name) : ""}
                           />
                       </a>
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
                        disabled={Boolean(connectingId)}
                        onClick={() => handleConnect(channel.id)}
                       >
                          <span>
                             <div className='relative'>
                              {connectingId === channel.id ? (
                                <div className="size-6 flex items-center justify-center">
                                  <Spinner className="size-4" />
                                </div>
                              ) : icon ? (
                                <HugeiconsIcon icon={icon} color='currentColor'
                                className=" text-white! size-6! p-1 rounded-sm"
                                  style={{ background: channel.color}}
                                />
                              ) : null}

                              {connectingId !== channel.id && (
                                <div className={`absolute -right-1 bottom-0 p-0.5
                                   bg-white dark:bg-background rounded-xs
                                  `}>
                                    <HugeiconsIcon icon={PlusSignIcon} className="size-2!" />
                                  </div>
                              )}
                             </div>
                          </span>
                          <span className='truncate'>
                            {connectingId === channel.id ? "Connecting..." : channel.name}
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
    </>
  )
}

export default AppSidebar