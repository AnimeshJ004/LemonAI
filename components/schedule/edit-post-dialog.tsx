"use client"
import * as React from "react"
import { parse, set } from "date-fns"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    Wand2,
    ScanEye,
    Lightbulb,
    Zap,
} from "lucide-react"
import { ScheduleDatePicker } from "./schedule-date-picker"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChannelType } from "@/types/channel.type"
import { ButtonGroup } from "../ui/button-group"
import { Spinner } from "../ui/spinner"
import { ImageObject } from "@/types/post.type"
import { POST_STATUS, PostStatus } from "@/constants/post"
import { getChannelIcon } from "@/constants/channels"
import ContentTextarea from "../content-textarea"
import IdeasList from "./ideas-list"
import PreviewPanel from "./preview"
import { AIAssistant } from "./ai-assitant"

interface EditPostDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    post: {
        id: string
        content: string
        images: ImageObject[]
        userChannelId: string
        scheduledDate: string
        channel?: ChannelType | null
        allPosts?: any[] | null
    } | null
}

type ActionTabType = "ideas" | "ai" | "preview"

const rightTabs = [
    { id: "ideas" as ActionTabType, label: "Ideas", icon: Lightbulb },
    { id: "ai" as ActionTabType, label: "AI Assistant", icon: Wand2 },
    { id: "preview" as ActionTabType, label: "Preview", icon: ScanEye },
]

export function EditPostDialog({
    open,
    onOpenChange,
    post
}: EditPostDialogProps) {


    const queryClient = useQueryClient();

    const updatePostMutation = useMutation({
        mutationFn: async ({ postId, content, images, scheduledAt, status }: {
            postId: string,
            content: string,
            images: ImageObject[],
            scheduledAt: string,
            status?: PostStatus,
            userChannelId: string
        }) => {
            const response = await fetch(`/api/post/${postId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content,
                    images,
                    scheduledAt,
                    status
                })
            });
            if (!response.ok) throw new Error("Failed to update post");
            return response.json();
        },
        onSuccess: (data, variables) => {
            toast.success(`Post ${variables.status === POST_STATUS.DRAFT ? "saved to drafts" : "rescheduled"} successfully!`);
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            onOpenChange(false);
        },
        onError: (error: any) => {
            console.error("Update error:", error);
            toast.error(error.message);
        }
    });

    const publishMutation = useMutation({
        mutationFn: async (postId: string) => {
            const res = await fetch(`/api/post/${postId}/publish`, {
                method: "POST",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to publish post");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Post published successfully!");
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "posts" });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.message || "Failed to publish post");
        }
    });

    const [activePostId, setActivePostId] = React.useState<string>("")
    const [content, setContent] = React.useState("")
    const [images, setImages] = React.useState<ImageObject[]>([])
    const [date, setDate] = React.useState<Date | undefined>(new Date())
    const [time, setTime] = React.useState<string>("")
    const [selectedRightTab, setSeletedRightTab] = React.useState<ActionTabType | null>(null)
    const [activeChannel, setActiveChannel] = React.useState<any>(null)
    const [activeUserChannelId, setActiveUserChannelId] = React.useState<string>("")

    // Sync state when post changes
    React.useEffect(() => {
        if (post) {
            setActivePostId(post.id)
            setContent(post.content)
            setImages(post.images ?? [])
            setActiveChannel(post.channel)
            setActiveUserChannelId(post.userChannelId)
            const rawDate = post.scheduledDate ? new Date(post.scheduledDate) : new Date()
            const safeDate = !isNaN(rawDate.getTime()) ? rawDate : new Date()
            setDate(safeDate)
            // Extract time from scheduledDate
            const hours = safeDate.getHours()
            const minutes = safeDate.getMinutes()
            const ampm = hours >= 12 ? "PM" : "AM"
            const h = hours % 12 || 12
            const m = minutes.toString().padStart(2, "0")
            setTime(`${h}:${m} ${ampm}`)
        }
    }, [post])

    const handleSwitchChannel = (targetPost: any) => {
        setActivePostId(targetPost.id)
        setContent(targetPost.content || "")
        setImages(targetPost.images ?? [])
        const ch = targetPost.user_channels?.channel_types ? {
            ...targetPost.user_channels.channel_types,
            profile_image: targetPost.user_channels.profile_image,
            handle: targetPost.user_channels.handle
        } : (targetPost.channel || null)
        setActiveChannel(ch)
        setActiveUserChannelId(targetPost.user_channel_id || "")
    }

    const channel = activeChannel || post?.channel
    const icon = channel ? getChannelIcon(channel.type) : null

    const handleUpdate = (status?: PostStatus) => {
        const currentPostId = activePostId || post?.id
        const currentUserChannelId = activeUserChannelId || post?.userChannelId
        if (!currentPostId) return
        const parsedTime = parse(time, "h:mm a", new Date())
        const finalDate = set(date || new Date(), {
            hours: parsedTime.getHours(),
            minutes: parsedTime.getMinutes(),
            seconds: 0,
            milliseconds: 0
        })

        updatePostMutation.mutate({
            postId: currentPostId,
            content,
            images,
            scheduledAt: finalDate.toISOString(),
            status: status,
            userChannelId: currentUserChannelId || ""
        });
    }

    const handleAddIdea = (idea: any) => {
        setContent(idea.description || "")
        setImages(idea.images || [])
    }

    const handleSelectRightTab = (tab: ActionTabType) => {
        setSeletedRightTab((prev) => (prev === tab ? null : tab))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "w-[95vw] sm:max-w-[700px] max-h-[92vh] sm:max-h-[90vh] gap-0 px-0 pt-0 pb-0 overflow-hidden flex flex-col rounded-2xl",
                selectedRightTab && "sm:max-w-[950px]"
            )}>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 sm:px-8 py-3.5 border-b shrink-0">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-lg font-semibold">Edit Post</DialogTitle>
                            <div className="flex items-center gap-px">
                                {rightTabs.map((tab) => (
                                    <Button
                                        key={tab.id}
                                        variant={selectedRightTab === tab.id ? "default" : "ghost"}
                                        className={cn(!selectedRightTab && "size-8", "")}
                                        onClick={() => handleSelectRightTab(tab.id)}
                                    >
                                        <tab.icon className="h-4 w-4" />
                                        <span className={cn(!selectedRightTab && "hidden")}>{tab.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </DialogHeader>
                    <DialogDescription className="sr-only">Edit scheduled post details</DialogDescription>

                    {/* ── Main panel ── */}
                    <div className="w-full flex flex-1 min-w-0 min-h-0 overflow-y-auto max-h-[calc(90vh-130px)]">

                        {/* Left panel */}
                        <div className="flex flex-1 flex-col min-w-0 w-[300px] pb-5 overflow-y-auto">

                            <section className="channel--composer relative 
                                            flex-1 flex flex-col 
                                            border-b 
                                            px-8 pt-6 pb-2
                                            bg-muted/10
                                            ">
                                <div className="space-y-4">
                                    {post?.allPosts && post.allPosts.length > 1 && (
                                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-muted/40 rounded-xl border border-border/60">
                                            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Channels ({post.allPosts.length}):</span>
                                            {post.allPosts.map((p: any) => {
                                                const ch = p.user_channels?.channel_types
                                                const chIcon = ch ? getChannelIcon(ch.type) : null
                                                const isSelected = (activePostId || post.id) === p.id
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => handleSwitchChannel(p)}
                                                        className={cn(
                                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                                            isSelected 
                                                                ? "bg-background text-foreground shadow-xs border border-border ring-1 ring-primary/20" 
                                                                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                                        )}
                                                    >
                                                        {chIcon && (
                                                            <div 
                                                                className="size-4 rounded flex items-center justify-center shrink-0 shadow-2xs" 
                                                                style={{ background: ch?.color || "#3b82f6" }}
                                                            >
                                                                <HugeiconsIcon icon={chIcon} className="size-2.5 text-white" />
                                                            </div>
                                                        )}
                                                        <span>{ch?.name || ch?.type || "Channel"}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}

                                    <div className="relative">
                                        {icon && (
                                            <div className="absolute top-0 left-0">
                                                <HugeiconsIcon
                                                    icon={icon}
                                                    style={{ background: channel?.color }}
                                                    className="size-5 text-white! p-1 rounded-sm"
                                                />
                                            </div>
                                        )}
                                        <div className={cn(icon && "pl-8")}>
                                            <ContentTextarea
                                                value={content}
                                                images={images}
                                                placeholder="Start writing or get inspired by AI..."
                                                minHeight={350}
                                                contentClass="text-[15px] placeholder:opacity-50 pt-0!"
                                                showAIAssistant={true}
                                                onAIAssistantClick={() => handleSelectRightTab("ai")}
                                                onChange={setContent}
                                                onImagesChange={setImages}
                                                renderToolbarRight={
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn(
                                                            "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                                            channel && content.length >= Number(channel.character_limit) * 0.9
                                                                ? "bg-orange-100 text-orange-600"
                                                                : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {content.length} / {channel?.character_limit || 280}
                                                        </span>
                                                    </div>
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Right Side Panel */}
                        {selectedRightTab && (
                            <aside className="w-[350px] shrink-0 border-l border-border bg-muted/30 min-h-0 flex flex-col overflow-y-auto">
                                <div className="py-4 flex-1 min-h-0 flex flex-col">
                                    {selectedRightTab === "ai" && (
                                        <div className="px-6 flex flex-col">
                                            <AIAssistant
                                                content={content}
                                                channelId={post?.channel?.id}
                                                onGenerate={(data) => {
                                                    const text = typeof data === "string" ? data : data?.content || ""
                                                    setContent(text)
                                                }}
                                            />
                                        </div>
                                    )}
                                    {selectedRightTab === "ideas" && (
                                        <IdeasList
                                            onSelect={handleAddIdea}
                                        />
                                    )}

                                    {selectedRightTab === "preview" && (
                                        <PreviewPanel
                                            channel={channel || null}
                                            content={{ text: content, images }}
                                        />
                                    )}
                                </div>
                            </aside>
                        )}
                    </div>

                </div>

                <DialogFooter className="px-6 sm:px-8 py-3.5 border-t shrink-0 bg-background/95 backdrop-blur-xs z-20 m-0!">
                    <div className="w-full flex items-center justify-between gap-2">
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => handleUpdate(POST_STATUS.DRAFT)}
                            disabled={updatePostMutation.isPending || publishMutation.isPending}
                        >
                            {updatePostMutation.isPending && updatePostMutation.variables?.status === POST_STATUS.DRAFT && <Spinner />}
                            Save Draft
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="lg"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                                disabled={publishMutation.isPending || updatePostMutation.isPending}
                                onClick={() => {
                                    const targetId = activePostId || post?.id
                                    if (targetId) {
                                        publishMutation.mutate(targetId);
                                    }
                                }}
                            >
                                {publishMutation.isPending ? <Spinner /> : <Zap className="size-4 mr-1.5 fill-white" />}
                                Publish Now
                            </Button>
                            <ButtonGroup className="p-0!">
                                <ScheduleDatePicker
                                    date={date} setDate={setDate} time={time} setTime={setTime}
                                    renderButton={(isDatePassed, isTimeNotAvailable) => <Button
                                        size="lg"
                                        className="border py-4.5 px-4"
                                        onClick={() => {
                                            if (isDatePassed || isTimeNotAvailable) {
                                                toast.error("Please select a valid time")
                                                return;
                                            }
                                            handleUpdate()
                                        }}
                                        disabled={updatePostMutation.isPending || publishMutation.isPending || !date || !time || isTimeNotAvailable || isDatePassed}
                                    >
                                        {updatePostMutation.isPending && updatePostMutation.variables?.status === undefined && <Spinner />}
                                        Schedule Post
                                    </Button>}
                                />
                            </ButtonGroup>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
