import { ChannelType } from "./channel.type";

export type ImageObject = {
  url: string;
  key: string;
  media_type?: string;
  thumbnail_url?: string;
}


export type PostType = {
    id: string
    content: string
    images?: ImageObject[]
    scheduled_at: string
    status: string
    published_url?: string | null
    error_message?: string | null
    user_channel_id?: string | null
    user_channels?: {
        id: string;
        handle?: string | null
        profile_image?: string | null
        profile_url?: string | null
        channel_type_id?: string
        provider_account_id?: string | null
        access_token?: string | null
        refresh_token?: string | null
        token_expires_at?: string | null
        channel_types?: ChannelType
    },
    created_at: string;
    updated_at: string;
}


export type CalendarPostType = {
  id: string
  content: string
  images: ImageObject[]
  scheduledAt: Date
  status: "queue" | "draft" | "published" | "failed"
  error_message?: string | null
  user_channel_id: string
  channel_types: ChannelType
}

/**
 * CalendarPost
 *
 * Extended shape used by the calendar view when merging a clicked post with
 * calendar-specific runtime metadata. Declaring these fields here removes the
 * `(mergedPost as any).*` casts in components/schedule/calendar-view.tsx.
 */
export type CalendarPost = PostType & {
  /** All posts that fall on the same calendar cell (multi-post days). */
  allPosts?: PostType[]
  /** The channel type currently in focus for the clicked calendar entry. */
  activeChannelType?: string
  /** Alternate scheduled start timestamp used by some calendar sources. */
  start?: string
  /** Pre-resolved channel object attached to the calendar entry. */
  channel?: ChannelType | null
}
