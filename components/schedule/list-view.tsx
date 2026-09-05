"use client";
import { PostType } from "@/types/post.type";
import { keepPreviousData, useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import ScheduleToolbar from "./schedule-toolbar";
import { Skeleton } from "../ui/skeleton";
import {
  AlarmClockCheck,
  ExternalLink,
  LayoutList,
  Pencil,
  Pin,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import { format, formatDistanceToNow, isPast, parseISO } from "date-fns";
import { Card, CardContent, CardFooter } from "../ui/card";
import ChannelAvatar from "../channel-avatar";
import { EditPostDialog } from "./edit-post-dialog";
import { toast } from "sonner";
import { Spinner } from "../ui/spinner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

type TabType = "draft" | "queue" | "published" | "failed";

type GroupPostType = {
  key: string;
  label: string;
  posts: PostType[];
};

const ListView = ({
  setCreatePostModalOpen,
}: {
  setCreatePostModalOpen: (open: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useQueryState("status", {
    defaultValue: "draft",
  });
  const [channelIds, setChannelIds] = useQueryState("channelIds", {
    defaultValue: [],
    parse: (query) => query.split(","),
    serialize: (value) => value.join(","),
  });

  const [selectedPostForEdit, setSelectedPostForEdit] = useState<PostType | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<PostType | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  const [postsQuery, totalsQuery] = useQueries({
    queries: [
      {
        queryKey: ["posts", activeTab, channelIds],
        queryFn: async () => {
          const params = new URLSearchParams();
          params.append("group_by_date", "true");
          if (activeTab) params.append("status", activeTab);
          if (channelIds.length > 0) params.append("channelIds", channelIds.join(","));
          const res = await fetch(`/api/post?${params.toString()}`);
          if (!res.ok) throw new Error("Failed to fetch posts");
          return res.json();
        },
      },
      {
        queryKey: ["posts", "totals", channelIds],
        queryFn: async () => {
          const params = new URLSearchParams();
          if (channelIds.length > 0) params.append("channelIds", channelIds.join(","));
          const res = await fetch(`/api/post/totals?${params.toString()}`);
          if (!res.ok) throw new Error("Failed to fetch totals");
          return res.json();
        },
      },
    ],
  });

  const data = postsQuery.data;
  const isPending = postsQuery.isFetching;
  const totalPosts = totalsQuery.data;
  const isTotalsFetching = totalsQuery.isFetching;

  // ── Publish Post ──────────────────────────────────────────────────────────
  const publishPostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/post/${postId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to publish post");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Post processing...");
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "posts" });
    },
  });

  // ── Delete Post ───────────────────────────────────────────────────────────
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/post/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Post deleted. AI memory updated.");
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "posts" });
      setPostToDelete(null);
    },
    onError: () => {
      toast.error("Failed to delete post");
      setPostToDelete(null);
    },
  });

  // ── 👍 Like (Positive Signal) ─────────────────────────────────────────────
  const likePostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch("/api/ai/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalType: "positive",
          finalContent: content,
          postId,
        }),
      });
      if (!res.ok) throw new Error("Failed to record feedback");
      return res.json();
    },
    onSuccess: (_, { postId }) => {
      setLikedPostIds((prev) => new Set([...prev, postId]));
      toast.success("AI learned from your feedback! 🧠", { duration: 2000 });
    },
  });

  // ── 👎 Dislike (Explicit Negative Signal) ─────────────────────────────────
  const dislikePostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch("/api/ai/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalType: "explicit",
          originalContent: content,
          feedbackText: "User disliked this style of content",
          postId,
        }),
      });
      if (!res.ok) throw new Error("Failed to record feedback");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Noted! AI will avoid this style. 🧠", { duration: 2000 });
    },
  });

  const groupPosts = (data?.groupPosts || []) as GroupPostType[];
  const totalDrafts = totalPosts?.totalDrafts || 0;
  const totalQueue = totalPosts?.totalQueue || 0;
  const totalPublished = totalPosts?.totalPublished || 0;
  const totalFailed = totalPosts?.totalFailed || 0;

  const renderTotalBadge = (total: number) => (
    <Badge variant="secondary" className="min-w-6">
      {isTotalsFetching ? <Spinner className="size-3" /> : total}
    </Badge>
  );

  const toggleChannel = (channelId: string) => {
    setChannelIds((prev) => {
      if (!prev) return [channelId];
      if (prev.includes(channelId)) {
        const filtered = prev.filter((id) => id !== channelId);
        return filtered.length === 0 ? null : filtered;
      }
      return [...prev, channelId];
    });
  };

  const handleEditPost = (post: PostType) => {
    setSelectedPostForEdit(post);
    setIsEditDialogOpen(true);
  };

  const handlePublishNow = (post: PostType) => {
    if (publishPostMutation.isPending) return;
    publishPostMutation.mutate(post.id);
  };

  return (
    <>
      <div className="flecx flex-col h-full pt-3">
        {/* ── Tab bar ── */}
        <div className="flex items-center justify-between border-b px-6">
          <Tabs value={activeTab || "draft"} onValueChange={(val) => setActiveTab(val)}>
            <TabsList variant="line" className="space-x-4">
              <TabsTrigger value="draft">Draft {renderTotalBadge(totalDrafts)}</TabsTrigger>
              <TabsTrigger value="queue">Queue {renderTotalBadge(totalQueue)}</TabsTrigger>
              <TabsTrigger value="published">Published {renderTotalBadge(totalPublished)}</TabsTrigger>
              <TabsTrigger value="failed">Failed {renderTotalBadge(totalFailed)}</TabsTrigger>
            </TabsList>
          </Tabs>
          <ScheduleToolbar
            viewType="list"
            channelIds={channelIds}
            toggleChannel={toggleChannel}
            selectedStatus={activeTab}
            setSelectedStatus={setActiveTab}
          />
        </div>

        {/* ── Post List ── */}
        <div className="flex-1 p-6">
          <div className="max-w-[900px] mx-auto w-full space-y-2">
            {isPending ? (
              <div className="space-y-8">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-10 w-56 rounded-md" />
                    <Skeleton className="h-[200px] w-full" />
                  </div>
                ))}
              </div>
            ) : groupPosts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="max-w-sm space-y-4">
                  <div className="mx-auto flex size-15 items-center justify-center rounded-full bg-muted">
                    <LayoutList className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold capitalize">
                    No {activeTab === "queue" ? "scheduled" : activeTab} posts yet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Connect a channel and create your first post to get started with scheduling.
                  </p>
                  <Button size="lg" onClick={() => setCreatePostModalOpen(true)}>
                    <Plus className="size-4" />
                    Create Post
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-5">
                {groupPosts.map((group) => (
                  <div key={group.key}>
                    <h2 className="text-lg font-medium">{group.label}</h2>
                    <div className="space-y-6">
                      {group.posts.map((post) => {
                        const scheduleDate = parseISO(post.scheduled_at);
                        const channel = post.user_channels?.channel_types;
                        const previewImage = post.images?.[0]?.url;
                        const isLiked = likedPostIds.has(post.id);
                        const isPublished = post.status === "published";

                        return (
                          <div
                            key={post.id}
                            className="grid gap-2 lg:grid-cols-[120px_minmax(0,1fr)]"
                          >
                            {/* Time + Status */}
                            <div>
                              <h5>{format(scheduleDate, "h:mm a")}</h5>
                              <div
                                className={cn(
                                  "flex items-center gap-2",
                                  isPast(scheduleDate) &&
                                    (post.status === "queue" || post.status === "draft")
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                )}
                              >
                                <Pin className="size-4" />
                                <span className="capitalize">
                                  {isPast(scheduleDate) &&
                                  (post.status === "queue" || post.status === "draft")
                                    ? "Overdue"
                                    : post.status === "draft"
                                    ? "Draft"
                                    : "Custom"}
                                </span>
                              </div>
                            </div>

                            {/* Post Card */}
                            <Card className="py-0 gap-0">
                              <CardContent className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_250px]">
                                <div className="space-y-5">
                                  {channel ? (
                                    <ChannelAvatar
                                      type={channel.type}
                                      color={channel.color}
                                      profileImage={post.user_channels?.profile_image}
                                      name={post.user_channels?.handle || channel.name}
                                    />
                                  ) : null}
                                  <p className="whitespace-pre-wrap text-sm leading-6 line-clamp-4">
                                    {post.content}
                                  </p>
                                </div>

                                <div className="max-h-[165px] overflow-hidden rounded-2xl border bg-muted/40">
                                  {previewImage ? (
                                    <img
                                      src={previewImage}
                                      alt="Post media"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full-center justify-center text-sm text-muted-foreground">
                                      No media
                                    </div>
                                  )}
                                </div>
                              </CardContent>

                              <CardFooter className="flex flex-col gap-3 border-t px-6 py-3 md:flex-row md:items-center md:justify-between">
                                {/* Left: created info */}
                                <p className="text-sm text-muted-foreground">
                                  {isPublished ? (
                                    <>
                                      Published via{" "}
                                      <span className="font-medium text-foreground">
                                        {channel?.name || "Channel"}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      Created{" "}
                                      <span className="font-medium text-foreground">
                                        {formatDistanceToNow(parseISO(post.created_at))}
                                      </span>{" "}
                                      ago
                                    </>
                                  )}
                                </p>

                                {/* Right: Action Buttons */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* AI Feedback buttons — always visible */}
                                  {!isPublished && (
                                    <div className="flex items-center gap-1 mr-1 border rounded-lg px-1.5 py-1">
                                      <button
                                        id={`like-post-${post.id}`}
                                        title="Good post — AI learns from this"
                                        disabled={likePostMutation.isPending || isLiked}
                                        onClick={() =>
                                          likePostMutation.mutate({
                                            postId: post.id,
                                            content: post.content,
                                          })
                                        }
                                        className={cn(
                                          "p-1.5 rounded-md transition-colors",
                                          isLiked
                                            ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                                            : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                        )}
                                      >
                                        <ThumbsUp className="size-3.5" />
                                      </button>
                                      <button
                                        id={`dislike-post-${post.id}`}
                                        title="Not great — AI won't repeat this style"
                                        disabled={dislikePostMutation.isPending}
                                        onClick={() =>
                                          dislikePostMutation.mutate({
                                            postId: post.id,
                                            content: post.content,
                                          })
                                        }
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                      >
                                        <ThumbsDown className="size-3.5" />
                                      </button>
                                    </div>
                                  )}

                                  {isPublished && post.published_url ? (
                                    <Button asChild variant="outline">
                                      <a
                                        href={post.published_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                        View Post
                                      </a>
                                    </Button>
                                  ) : (
                                    <>
                                      {/* Edit Button */}
                                      <Button
                                        id={`edit-post-${post.id}`}
                                        variant="outline"
                                        onClick={() => handleEditPost(post)}
                                      >
                                        <Pencil className="size-4" />
                                        Edit
                                      </Button>

                                      {/* Reschedule Button */}
                                      <Button
                                        id={`reschedule-post-${post.id}`}
                                        variant="outline"
                                        onClick={() => handleEditPost(post)}
                                      >
                                        <AlarmClockCheck className="size-4" />
                                        Reschedule
                                      </Button>

                                      {/* Publish Now (drafts only) */}
                                      {post.status === "draft" && (
                                        <Button
                                          id={`publish-post-${post.id}`}
                                          variant="outline"
                                          disabled={publishPostMutation.isPending}
                                          onClick={() => handlePublishNow(post)}
                                        >
                                          {publishPostMutation.isPending ? (
                                            <Spinner />
                                          ) : (
                                            <Send className="size-4" />
                                          )}
                                          Publish Now
                                        </Button>
                                      )}

                                      {/* Delete Button */}
                                      <Button
                                        id={`delete-post-${post.id}`}
                                        variant="outline"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                        onClick={() => setPostToDelete(post)}
                                      >
                                        <Trash2 className="size-4" />
                                        Delete
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </CardFooter>
                            </Card>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditPostDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        post={
          selectedPostForEdit
            ? {
                id: selectedPostForEdit.id,
                content: selectedPostForEdit.content,
                images: selectedPostForEdit.images || [],
                scheduledDate: selectedPostForEdit.scheduled_at,
                userChannelId: selectedPostForEdit.user_channel_id || "",
                channel: selectedPostForEdit.user_channels?.channel_types
                  ? {
                      ...selectedPostForEdit.user_channels.channel_types,
                      profile_image: selectedPostForEdit.user_channels.profile_image,
                      handle: selectedPostForEdit.user_channels.handle,
                    }
                  : null,
              }
            : null
        }
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!postToDelete}
        onOpenChange={(open) => !open && setPostToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This post will be permanently deleted. The AI will also learn to avoid this type of
              content in future generations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => postToDelete && deletePostMutation.mutate(postToDelete.id)}
              disabled={deletePostMutation.isPending}
            >
              {deletePostMutation.isPending ? <Spinner className="size-4 mr-2" /> : null}
              Delete Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ListView;
