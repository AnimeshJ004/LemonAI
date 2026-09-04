"use client"
import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChannelType } from "@/types/channel.type"
import { ChannelTypeEnum, getChannelIcon } from "@/constants/channels"
import { HugeiconsIcon } from "@hugeicons/react"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { KeyRound, ShieldCheck, ExternalLink, HelpCircle } from "lucide-react"

interface ConnectChannelDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    channel: ChannelType | null
    onSuccess?: () => void
}

export function ConnectChannelDialog({
    open,
    onOpenChange,
    channel,
    onSuccess
}: ConnectChannelDialogProps) {
    const [handle, setHandle] = useState("")
    const [password, setPassword] = useState("")
    const [accessToken, setAccessToken] = useState("")
    const [providerAccountId, setProviderAccountId] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    React.useEffect(() => {
        if (channel && open) {
            setHandle(channel.handle ? channel.handle.replace(/^@/, '') : "")
            setProviderAccountId((channel as any).provider_account_id || "")
            setAccessToken("")
            setPassword("")
        }
    }, [channel, open])

    if (!channel) return null

    const icon = getChannelIcon(channel.type)
    const isBluesky = channel.type === ChannelTypeEnum.BLUESKY
    const isInstagram = channel.type === ChannelTypeEnum.INSTAGRAM
    const isFacebook = channel.type === ChannelTypeEnum.FACEBOOK
    const isTwitter = channel.type === ChannelTypeEnum.TWITTER
    const isLinkedIn = channel.type === ChannelTypeEnum.LINKEDIN
    const isThreads = channel.type === ChannelTypeEnum.THREADS || Boolean(channel.name?.toLowerCase().includes("thread"))
    const isYouTube = channel.type === ChannelTypeEnum.YOUTUBE
    const isTikTok = channel.type === ChannelTypeEnum.TIKTOK
    const isMeta = isInstagram || isFacebook

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isBluesky) {
            if (!handle.trim()) {
                toast.error("Please enter your Bluesky Handle (e.g. username.bsky.social)")
                return
            }
            if (!password.trim()) {
                toast.error("Please enter your Bluesky App Password")
                return
            }
        } else {
            if (!handle.trim()) {
                toast.error(`Please enter your ${channel.name} handle, username, or page name`)
                return
            }
            if (!accessToken.trim()) {
                toast.error(`Please enter your ${channel.name} Access Token or API Key`)
                return
            }
        }

        setIsLoading(true)
        try {
            const res = await fetch("/api/channel/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelTypeId: channel.id,
                    handle: handle.trim(),
                    password: password.trim(),
                    accessToken: accessToken.trim(),
                    providerAccountId: providerAccountId.trim() || undefined,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || `Failed to connect ${channel.name}`)
            }

            toast.success(`Successfully connected ${channel.name} (${data.handle || handle})!`)
            onSuccess?.()
            onOpenChange(false)
            setHandle("")
            setPassword("")
            setAccessToken("")
            setProviderAccountId("")
        } catch (err: any) {
            console.error("Connect error:", err)
            toast.error(err?.message || `Failed to connect ${channel.name}`)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div
                            className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: `${channel.color}20` }}
                        >
                            <HugeiconsIcon
                                icon={icon}
                                className="size-5"
                                style={{ color: channel.color }}
                            />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-semibold">
                                {channel.connected ? `Update ${channel.name}` : `Connect ${channel.name}`}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                {channel.connected
                                    ? `Update your credentials, token, or account ID for ${channel.name}.`
                                    : `Connect your account to enable automatic scheduling and publishing.`}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleConnect} className="space-y-4 py-2">
                    {/* Platform Specific Guidance */}
                    {isBluesky && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-950 dark:bg-blue-950/30 p-3.5 space-y-1.5 text-xs text-blue-900 dark:text-blue-200">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>How to get your Bluesky App Password:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground dark:text-blue-300/80">
                                Open Bluesky ➔ <span className="font-medium text-foreground">Settings ➔ Privacy and Security ➔ App Passwords ➔ Add App Password</span>.
                            </p>
                        </div>
                    )}

                    {isMeta && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50/60 dark:border-purple-950 dark:bg-purple-950/30 p-3.5 space-y-1.5 text-xs text-purple-900 dark:text-purple-200">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>Page / Profile Access Token:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground dark:text-purple-300/80">
                                Connect your Facebook Page or Instagram Business Profile Access Token from <span className="font-medium text-foreground">Meta Business Suite</span> to enable scheduled posts.
                            </p>
                        </div>
                    )}

                    {isTwitter && (
                        <div className="rounded-xl border border-sky-200 bg-sky-50/60 dark:border-sky-950 dark:bg-sky-950/30 p-3.5 space-y-1.5 text-xs text-sky-900 dark:text-sky-200">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>Twitter / X API Token:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground dark:text-sky-300/80">
                                Generate your Access Token / Bearer Token from the <span className="font-medium text-foreground">Twitter Developer Portal (developer.x.com)</span>.
                            </p>
                        </div>
                    )}

                    {isThreads && (
                        <div className="rounded-xl border border-neutral-300 bg-neutral-100/80 dark:border-neutral-800 dark:bg-neutral-900/60 p-3.5 space-y-1.5 text-xs text-foreground">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>Threads API Token:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground">
                                Get your Threads Access Token from <span className="font-medium text-foreground">Meta for Developers (Threads API)</span>.
                            </p>
                        </div>
                    )}

                    {isYouTube && (
                        <div className="rounded-xl border border-red-200 bg-red-50/60 dark:border-red-950 dark:bg-red-950/30 p-3.5 space-y-1.5 text-xs text-red-900 dark:text-red-200">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>YouTube Access Token:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground dark:text-red-300/80">
                                Get your Access Token from <span className="font-medium text-foreground">Google OAuth Playground</span> (select YouTube Data API v3) or Google Cloud Console.
                            </p>
                        </div>
                    )}

                    {isLinkedIn && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-950 dark:bg-blue-950/30 p-3.5 space-y-1.5 text-xs text-blue-900 dark:text-blue-200">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>LinkedIn Access Token:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground dark:text-blue-300/80">
                                Generate your OAuth Token or Member Access Token from the <span className="font-medium text-foreground">LinkedIn Developer Portal</span>.
                            </p>
                        </div>
                    )}

                    {isTikTok && (
                        <div className="rounded-xl border border-pink-200 bg-pink-50/60 dark:border-pink-950 dark:bg-pink-950/30 p-3.5 space-y-1.5 text-xs text-pink-900 dark:text-pink-200">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>TikTok API Token:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground dark:text-pink-300/80">
                                Generate your Access Token from the <span className="font-medium text-foreground">TikTok for Developers Portal</span>.
                            </p>
                        </div>
                    )}

                    {/* Handle / Username Input */}
                    <div className="space-y-1.5">
                        <Label htmlFor="channel-handle" className="text-xs font-semibold">
                            {isBluesky 
                                ? "Bluesky Handle / Identifier *" 
                                : isInstagram 
                                ? "Instagram Username / Handle *" 
                                : isFacebook 
                                ? "Facebook Page Name or Handle *" 
                                : isTwitter 
                                ? "Twitter / X Handle *" 
                                : isThreads
                                ? "Threads Handle *"
                                : `${channel.name} Account Handle / Name *`}
                        </Label>
                        <Input
                            id="channel-handle"
                            placeholder={
                                isBluesky
                                    ? "e.g. username.bsky.social"
                                    : isInstagram
                                    ? "e.g. @your_instagram"
                                    : isTwitter
                                    ? "e.g. @your_handle"
                                    : isThreads
                                    ? "e.g. @your_threads"
                                    : isFacebook
                                    ? "e.g. DentalClinicOfficial"
                                    : "e.g. @your_username"
                            }
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {/* Bluesky App Password */}
                    {isBluesky ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="channel-password" className="text-xs font-semibold">
                                App Password *
                            </Label>
                            <Input
                                id="channel-password"
                                type="password"
                                placeholder="xxxx-xxxx-xxxx-xxxx"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>
                    ) : (
                        <>
                            {/* Provider Account / Page ID */}
                            {(isInstagram || isFacebook || isLinkedIn) && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="channel-account-id" className="text-xs font-semibold">
                                            {isInstagram
                                                ? "Instagram Business Account ID"
                                                : isFacebook
                                                ? "Facebook Page ID"
                                                : "LinkedIn Author URN / ID"}
                                        </Label>
                                        {!isInstagram && (
                                            <span className="text-[11px] text-muted-foreground">
                                                Optional
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        id="channel-account-id"
                                        placeholder={
                                            isInstagram
                                                ? "e.g. 17841400000000000"
                                                : isFacebook
                                                ? "e.g. 1000854321..."
                                                : "e.g. 12345678"
                                        }
                                        value={providerAccountId}
                                        onChange={(e) => setProviderAccountId(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            )}

                            {/* Access Token / API Key */}
                            <div className="space-y-1.5">
                                <Label htmlFor="channel-token" className="text-xs font-semibold">
                                    {isMeta
                                        ? "Page / Profile Access Token *"
                                        : isTwitter
                                        ? "Twitter / X User Access Token or Bearer Token *"
                                        : isThreads
                                        ? "Threads User Access Token *"
                                        : isYouTube
                                        ? "YouTube / Google OAuth Access Token *"
                                        : isLinkedIn
                                        ? "LinkedIn Member Access Token *"
                                        : isTikTok
                                        ? "TikTok User Access Token *"
                                        : `${channel.name} Access Token / API Key *`}
                                </Label>
                                <Input
                                    id="channel-token"
                                    type="password"
                                    placeholder="Paste your token or key here..."
                                    value={accessToken}
                                    onChange={(e) => setAccessToken(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </>
                    )}

                    <DialogFooter className="pt-3 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="text-xs"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            size="sm"
                            disabled={isLoading}
                            className="text-xs font-semibold min-w-[150px] text-white shadow-sm hover:opacity-90"
                            style={{ 
                                backgroundColor: channel.color || "#000000",
                                color: "#ffffff"
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Spinner className="size-3.5 mr-1.5 text-white" />
                                    <span className="text-white font-medium">{channel.connected ? "Updating..." : "Verifying..."}</span>
                                </>
                            ) : (
                                <span className="text-white font-medium">
                                    {channel.connected ? `Update ${channel.name}` : `Verify & Connect ${channel.name}`}
                                </span>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}


