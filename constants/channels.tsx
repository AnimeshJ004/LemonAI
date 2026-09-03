import { InstagramIcon, NewTwitterIcon, FacebookIcon, TiktokIcon, ThreadsIcon, YoutubeIcon, LinkedinIcon, BlueskyIcon } from '@hugeicons/core-free-icons'

export enum ChannelTypeEnum {
  TWITTER = "TWITTER",
  INSTAGRAM = "INSTAGRAM",
  THREADS = "THREADS",
  FACEBOOK = "FACEBOOK",
  LINKEDIN = "LINKEDIN",
  BLUESKY = "BLUESKY",
  YOUTUBE = "YOUTUBE",
  TIKTOK = "TIKTOK"
}

export const CHANNEL_TYPE_ICONS: Record<ChannelTypeEnum, any> = {
  [ChannelTypeEnum.TWITTER]: NewTwitterIcon,
  [ChannelTypeEnum.LINKEDIN]: LinkedinIcon,
  [ChannelTypeEnum.INSTAGRAM]: InstagramIcon,
  [ChannelTypeEnum.THREADS]: ThreadsIcon,
  [ChannelTypeEnum.FACEBOOK]: FacebookIcon,
  [ChannelTypeEnum.BLUESKY]: BlueskyIcon,
  [ChannelTypeEnum.YOUTUBE]: YoutubeIcon,
  [ChannelTypeEnum.TIKTOK]: TiktokIcon,
}

export const CHANNEL_TYPE_URLS: Record<ChannelTypeEnum, string> = {
  [ChannelTypeEnum.TWITTER]: "https://x.com",
  [ChannelTypeEnum.LINKEDIN]: "https://linkedin.com/in",
  [ChannelTypeEnum.INSTAGRAM]: "https://instagram.com",
  [ChannelTypeEnum.THREADS]: "https://threads.net",
  [ChannelTypeEnum.FACEBOOK]: "https://facebook.com",
  [ChannelTypeEnum.BLUESKY]: "https://bsky.app/profile",
  [ChannelTypeEnum.YOUTUBE]: "https://youtube.com",
  [ChannelTypeEnum.TIKTOK]: "https://tiktok.com",
}


export function getChannelUrl(type: ChannelTypeEnum | undefined) {
  if (!type) return ""
  return CHANNEL_TYPE_URLS[type]
}

export function getChannelProfileUrl(type: ChannelTypeEnum | undefined, handle: string | null | undefined) {
  if (!type || !handle) return ""
  const baseUrl = CHANNEL_TYPE_URLS[type] || ""
  const cleanHandle = handle.replace(/^@/, '').trim()
  if (!cleanHandle) return ""

  if (type === ChannelTypeEnum.YOUTUBE) {
    if (cleanHandle.startsWith("UC") && cleanHandle.length === 24) {
      return `${baseUrl}/channel/${cleanHandle}`
    }
    return `${baseUrl}/@${cleanHandle}`
  }

  if (type === ChannelTypeEnum.TIKTOK || type === ChannelTypeEnum.THREADS) {
    return `${baseUrl}/@${cleanHandle}`
  }

  if (type === ChannelTypeEnum.LINKEDIN) {
    if (cleanHandle.startsWith("company/") || cleanHandle.startsWith("school/") || cleanHandle.startsWith("in/")) {
      return `https://linkedin.com/${cleanHandle}`
    }
    return `https://linkedin.com/in/${cleanHandle}`
  }

  if (type === ChannelTypeEnum.BLUESKY) {
    return `${baseUrl}/${cleanHandle}`
  }

  return `${baseUrl}/${cleanHandle}`
}


export function getChannelIcon(type: ChannelTypeEnum | undefined) {
  if (!type) return null
  return CHANNEL_TYPE_ICONS[type]
}