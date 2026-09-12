
"use client"

import { PostType } from "@/types/post.type"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useQueryState } from "nuqs"
import { useState } from "react"
import { PostCalendar } from "./post-calendar"
import ScheduleToolbar from "./schedule-toolbar"
import CreatePostDialog from "./create-post-dialog"
import { EditPostDialog } from "./edit-post-dialog"

type ViewType = "month" | "week"

const CalendarView = () => {
  const [view, setView] = useQueryState("view", { defaultValue: "month" })
  const [channelIds, setChannelIds] = useQueryState("channelIds", {
    defaultValue: [],
    parse: (query) => query.split(","),
    serialize: (value) => value.join(",")
  })
  const [selectedStatus, setSelectedStatus] = useQueryState("status",
    {
      defaultValue: ""

    })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedPostForEdit, setSelectedPostForEdit] = useState<PostType | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const { data, isFetching:isPending } = useQuery({
    queryKey: ["posts", selectedStatus, channelIds],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedStatus && selectedStatus !== "all") {
        params.append("status", selectedStatus)
      }
      if (channelIds.length > 0) {
        params.append("channelIds", channelIds.join(","))
      }
      const res = await fetch(`/api/post?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const posts = data?.posts || [] as PostType[]

  const handlePostClick = (_post: any, allPosts?: any[], activeChannelType?: string) => {
    if (!_post) return
    const post = posts.find((p: PostType) => p.id === _post.id) || _post
    const mergedPost = { ...post }
    if (allPosts && allPosts.length > 0) {
      (mergedPost as any).allPosts = allPosts
    } else if (_post.allPosts && _post.allPosts.length > 0) {
      (mergedPost as any).allPosts = _post.allPosts
    }
    (mergedPost as any).activeChannelType = activeChannelType
    setSelectedPostForEdit(mergedPost)
    setIsEditDialogOpen(true)
  }

  const toggleChannel = (channelId: string) => {
    setChannelIds((prev) => {
      if (!prev) {
        return [channelId]
      }
      if (prev.includes(channelId)) {
        const filtered = prev.filter((id) => id !== channelId)
        return filtered.length === 0 ? null : filtered
      }
      return [...prev, channelId]
    })
  }

  const handleCreatePost = (date: Date) => {
    setSelectedDate(date)
    setIsCreateDialogOpen(true)
  }

  return (
    <div className="flex flex-col w-full min-w-0 h-full overflow-hidden bg-background">
      <div className="h-[calc(100vh-140px)] w-full min-w-0 flex flex-col">
        <div className="flex-1 p-2 sm:p-4 pt-1 h-full w-full min-w-0 overflow-x-auto">
          <PostCalendar
            posts={posts}
            isPending={isPending}
            currentDate={currentDate}
            view={view as ViewType}
            onViewChange={setView}
            onDateChange={setCurrentDate}
            onPostClick={handlePostClick}
            onCreatePost={handleCreatePost}
            rightActions={
              <ScheduleToolbar
                channelIds={channelIds}
                toggleChannel={toggleChannel}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
              />
            }
          />
        </div>
      </div>


      <EditPostDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        post={selectedPostForEdit ? {
          id: selectedPostForEdit.id,
          content: selectedPostForEdit.content || "",
          images: selectedPostForEdit.images || [],
          scheduledDate: selectedPostForEdit.scheduled_at || (selectedPostForEdit as any).start || new Date().toISOString(),
          userChannelId: selectedPostForEdit.user_channel_id || "",
          status: selectedPostForEdit.status,
          publishedUrl: selectedPostForEdit.published_url,
          errorMessage: selectedPostForEdit.error_message,
          handle: selectedPostForEdit.user_channels?.handle,
          channel: selectedPostForEdit.user_channels?.channel_types ? {
            ...selectedPostForEdit.user_channels.channel_types,
            profile_image: selectedPostForEdit.user_channels.profile_image,
            handle: selectedPostForEdit.user_channels.handle
          } : ((selectedPostForEdit as any).channel || null),
          allPosts: (selectedPostForEdit as any).allPosts || null,
          activeChannelType: (selectedPostForEdit as any).activeChannelType,
        } : null}
      />

      <CreatePostDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        selectedDate={selectedDate}
      />
    </div>
  )
}

export default CalendarView