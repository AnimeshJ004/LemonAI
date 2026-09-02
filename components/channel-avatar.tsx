"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { ChannelTypeEnum, getChannelIcon } from "@/constants/channels"

type ChannelAvatarProps = {
  type: ChannelTypeEnum
  color: string
  profileImage?: string | null
  name?: string | null
  size?: "sm" | "md"
  className?: string
}

const ChannelAvatar = ({
  type,
  color,
  profileImage,
  name,
  size = "md",
  className = "inline-flex items-center gap-2",
}: ChannelAvatarProps) => {
  const icon = getChannelIcon(type)

  return (
    <div className={cn(className)}>
      <Avatar
        className={cn(
          size === "sm" ? "size-8" : "size-10",
          "border border-border/60 shadow-xs overflow-hidden relative rounded-xl"
        )}
      >
        <AvatarImage src={profileImage || "/images/avatar.webp"} className="object-cover rounded-xl" />
        <AvatarFallback style={{ backgroundColor: color }} className="text-white text-xs font-bold rounded-xl">
          {name ? name.slice(0, 2).toUpperCase() : type ? type.slice(0, 2) : "CH"}
        </AvatarFallback>
        {icon ? (
          <div
            className={cn(
              "absolute right-[-2px] bottom-[-2px] z-10 inline-flex items-center justify-center",
              "rounded-md bg-background p-[1px] shadow-xs",
              size === "sm" ? "size-[15px]" : "size-[18px]"
            )}
          >
            <span
              className="flex size-full items-center justify-center rounded-md p-[2px]"
              style={{ backgroundColor: color }}
            >
              <HugeiconsIcon
                icon={icon}
                className="text-white size-2.5"
              />
            </span>
          </div>
        ) : null}
      </Avatar>

      {name ? (
        <span className="truncate font-medium text-sm">{name}</span>
      ) : null}
    </div>
  )
}

export default ChannelAvatar
