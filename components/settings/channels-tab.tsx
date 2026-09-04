
"use client"
import { Suspense,useState, useEffect } from 'react'
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation'
import { ChannelType } from '@/types/channel.type';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { getChannelIcon } from '@/constants/channels';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';

import { ConnectChannelDialog } from './connect-channel-dialog';

function ChannelTabContent() {
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const [connectingId, setConnectingId] = useState<string | null>(null)
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
    const [selectedChannelForConnect, setSelectedChannelForConnect] = useState<ChannelType | null>(null)
    const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false)

    const { data: channelsData, isPending } = useQuery({
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

    useEffect(() => {
        const connected = searchParams.get("connected")
        const error = searchParams.get("error")
        const channelType = searchParams.get("channelType")
        const isDemo = searchParams.get("demo") === "true"

        if (!connected && !error) return
        queryClient.invalidateQueries({ queryKey: ["channels"] })
        if (connected === "true") {
            if (isDemo) {
                toast.success(`Connected demo ${channelType} account (Configure API keys in .env.local for live OAuth)`)
            } else {
                toast.success(`Successfully connected to ${channelType}`)
            }
        }
        if (error) {
            toast.error(`Failed to connect to ${channelType || 'channel'}: ${error}`)
        }

        // Clean up URL query parameters
        const url = new URL(window.location.href)
        url.searchParams.delete("connected")
        url.searchParams.delete("error")
        url.searchParams.delete("channelType")
        url.searchParams.delete("demo")
        window.history.replaceState({}, "", url.toString())
    }, [queryClient, searchParams])

    const disconnectMutation = useMutation({
        mutationFn: async (userChannelId: string) => {
            setDisconnectingId(userChannelId)
            const res = await fetch("/api/channel/disconnect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userChannelId }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to start connection")
            return data
        },
        onSuccess: () => {
            setDisconnectingId(null)
            toast.success("Channel disconnected successfully")
            queryClient.invalidateQueries({ queryKey: ["channels"] })
        },
        onError: (error: Error) => {
            setDisconnectingId(null)
            console.error("Disconnect error:", error)
            toast.error("Failed to disconnect channel")
        },
    })

    const handleConnectClick = (channel: ChannelType) => {
        setSelectedChannelForConnect(channel)
        setIsConnectDialogOpen(true)
    }

    const handleDisconnect = (userChannelId: string) => {
        if (!userChannelId || connectingId || disconnectingId) return
        disconnectMutation.mutate(userChannelId)
    }

    const isActionRunning = Boolean(connectingId || disconnectingId)

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Channels</CardTitle>
                    <CardDescription>
                        Connect your social media accounts directly to start scheduling posts
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <div className='space-y-3'>
                        {isPending ? (
                            Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className='flex items-center justify-between rounded-xl border p-4'>
                                    <div className='flex items-center gap-3'>
                                        <Skeleton className='size-6 rounded-sm bg-secondary' />
                                        <Skeleton className='h-5 w-24 bg-secondary' />
                                    </div>
                                    <Skeleton className='h-8 w-20 bg-secondary' />
                                </div>
                            ))
                        ) : (
                            channels?.map((channel) => {
                                const icon = getChannelIcon(channel.type)
                                const isThisConnecting = Boolean(connectingId && connectingId === channel.id)
                                const isThisDisconnecting = Boolean(disconnectingId && disconnectingId === channel.user_channel_id)

                                return (
                                    <div key={channel.id}
                                        className='flex items-center justify-between rounded-xl border p-4 transition-colors hover:border-primary/20'
                                    >
                                        <div className='flex items-center gap-3'>
                                            <span className='relative'>
                                                {icon ? (
                                                    <HugeiconsIcon icon={icon}
                                                        color='currentColor'
                                                        className=" text-white! size-6! p-1 rounded-sm"
                                                        style={{ background: channel.color }}
                                                    />
                                                ) : null}

                                                <div className={cn(`absolute -right-1 bottom-0 p-0.5 bg-white dark:bg-background rounded-xs`,
                                                    {
                                                        "bg-transparent p-0 rounded-full -bottom-1 -right-0.5": channel.connected
                                                    }
                                                )}>
                                                    {channel.connected ? (
                                                        <div className='size-2.5 bg-primary rounded-full' />
                                                    ) : (
                                                        <HugeiconsIcon icon={PlusSignIcon} className="size-2!" />
                                                    )}
                                                </div>
                                            </span>

                                            <div className="flex flex-col">
                                                <span className='font-medium'>{channel.name}</span>
                                                {channel.handle && (
                                                    <span className='text-xs text-muted-foreground font-mono'>{channel.handle}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {channel.connected && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isActionRunning}
                                                    onClick={() => handleConnectClick(channel)}
                                                    className="h-8 px-3 text-xs font-medium border-border hover:bg-muted"
                                                >
                                                    Edit
                                                </Button>
                                            )}

                                            <Button 
                                                variant={channel.connected ? "destructive" : "default"} 
                                                size="sm"
                                                disabled={isActionRunning}
                                                onClick={() => channel.connected ? handleDisconnect(channel.user_channel_id!) : handleConnectClick(channel)}
                                                className="min-w-[90px] h-8 text-xs font-medium"
                                            >
                                                {isThisConnecting ? (
                                                    <>
                                                        <Spinner className='size-3.5 mr-1.5' />
                                                        <span>Connecting</span>
                                                    </>
                                                ) : isThisDisconnecting ? (
                                                    <>
                                                        <Spinner className='size-3.5 mr-1.5' />
                                                        <span>Disconnecting</span>
                                                    </>
                                                ) : (
                                                    channel.connected ? "Disconnect" : "Connect"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            <ConnectChannelDialog
                open={isConnectDialogOpen}
                onOpenChange={setIsConnectDialogOpen}
                channel={selectedChannelForConnect}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["channels"] })
                }}
            />
        </>
    )
}

const ChannelsTab = () => {
    return (
        <Suspense fallback={<div className="text-sm text-muted-foreground p-4">Loading channels...</div>}>
            <ChannelTabContent />
        </Suspense>
    )
}

export default ChannelsTab;
