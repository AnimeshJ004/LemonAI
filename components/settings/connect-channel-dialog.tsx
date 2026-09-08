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
import { KeyRound, ShieldCheck, ExternalLink, HelpCircle, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

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
    const [connectMode, setConnectMode] = useState<"oauth" | "manual">("oauth")

    React.useEffect(() => {
        if (channel && open) {
            setHandle(channel.handle ? channel.handle.replace(/^@/, '') : "")
            setProviderAccountId((channel as any).provider_account_id || "")
            setAccessToken("")
            setPassword("")
            // If OAuth is not configured in .env.local, default to manual tab; otherwise if connected default to manual else oauth
            if (channel.oauth_configured === false) {
                setConnectMode("manual")
            } else {
                setConnectMode(channel.connected ? "manual" : "oauth")
            }
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

        const hasExistingToken = Boolean(channel.connected && (channel as any).has_token);

        if (isBluesky) {
            if (!handle.trim()) {
                toast.error("Please enter your Bluesky Handle (e.g. username.bsky.social)")
                return
            }
            if (!password.trim() && !hasExistingToken) {
                toast.error("Please enter your Bluesky App Password")
                return
            }
        } else {
            if (!handle.trim()) {
                toast.error(`Please enter your ${channel.name} handle, username, or page name`)
                return
            }
            if (!accessToken.trim() && !hasExistingToken) {
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
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-border/80">
                {/* Pinned Header */}
                <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur-xs shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                            style={{ backgroundColor: `${channel.color}20` }}
                        >
                            <HugeiconsIcon
                                icon={icon}
                                className="size-5"
                                style={{ color: channel.color }}
                            />
                        </div>
                        <div className="min-w-0 flex-1 pr-6">
                            <DialogTitle className="text-base font-semibold truncate">
                                {channel.connected ? `Update ${channel.name}` : `Connect ${channel.name}`}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                                {channel.connected
                                    ? `Update your credentials, token, or account ID for ${channel.name}.`
                                    : `Connect your account to enable automatic scheduling and publishing.`}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleConnect} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    {/* Scrollable Middle Container */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        {/* Segmented Mode Switcher (for non-Bluesky channels) */}
                        {!isBluesky && (
                            <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl border text-xs font-semibold text-muted-foreground">
                                <button
                                    type="button"
                                    onClick={() => setConnectMode("oauth")}
                                    className={cn(
                                        "py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                                        connectMode === "oauth"
                                            ? "bg-background text-foreground shadow-xs font-semibold"
                                            : "hover:text-foreground"
                                    )}
                                >
                                    <ShieldCheck className="size-3.5 text-emerald-500" />
                                    1-Click OAuth
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConnectMode("manual")}
                                    className={cn(
                                        "py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                                        connectMode === "manual"
                                            ? "bg-background text-foreground shadow-xs font-semibold"
                                            : "hover:text-foreground"
                                    )}
                                >
                                    <KeyRound className="size-3.5 text-primary" />
                                    Manual Token
                                </button>
                            </div>
                        )}

                        {/* 1-Click OAuth View */}
                        {!isBluesky && connectMode === "oauth" && (
                            <div className="p-4 rounded-xl border bg-muted/20 space-y-3.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                                        <ShieldCheck className="size-4 text-emerald-500" />
                                        Official {channel.name} OAuth 2.0
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-muted rounded-full border">
                                        {channel.oauth_configured === false ? "Setup Required" : "Official"}
                                    </span>
                                </div>

                                {channel.oauth_configured === false ? (
                                    <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-950 dark:bg-amber-950/30 space-y-2.5 text-xs text-amber-900 dark:text-amber-200">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                            <span>OAuth Client ID Required in .env.local</span>
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-amber-300/80">
                                            1-Click OAuth requires <code className="font-mono font-semibold text-foreground">{channel.type}_CLIENT_ID</code> and <code className="font-mono font-semibold text-foreground">{channel.type}_CLIENT_SECRET</code> to be added in your <code className="font-mono font-semibold text-foreground">.env.local</code> file.
                                        </p>
                                        <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-amber-300/80">
                                            You can connect immediately without any developer setup using your Page Access Token in the <strong className="font-semibold text-foreground">Manual Token</strong> tab.
                                        </p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => setConnectMode("manual")}
                                            className="w-full text-xs font-semibold gap-1.5 h-8.5 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                                        >
                                            <KeyRound className="size-3.5" />
                                            Switch to Manual Token (Ready to Use)
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Authorize directly through official {channel.name} authentication. No manual developer token copy-pasting required.
                                        </p>

                                        {channel.connected && channel.handle && (
                                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                                                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span>Currently linked to: <strong className="font-semibold">{channel.handle}</strong></span>
                                            </div>
                                        )}

                                        <Button
                                            type="button"
                                            className="w-full text-xs font-semibold gap-2 h-10 text-white shadow-xs hover:opacity-90 transition-opacity"
                                            style={{ backgroundColor: channel.color || "#2563eb" }}
                                            onClick={() => {
                                                window.location.href = `/api/channel/oauth?channelTypeId=${channel.id}`;
                                            }}
                                        >
                                            <HugeiconsIcon icon={icon} className="size-4" />
                                            {channel.connected ? `Re-authorize with ${channel.name}` : `Connect with ${channel.name}`}
                                        </Button>

                                        <div className="pt-1 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setConnectMode("manual")}
                                                className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 cursor-pointer"
                                            >
                                                Or configure with manual Page Access Token / API Key
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Manual Credentials View (or Bluesky) */}
                        {(isBluesky || connectMode === "manual") && (
                            <div className="space-y-3.5">
                                {/* Platform Specific Guidance */}
                                {isBluesky && (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-950 dark:bg-blue-950/30 p-3 space-y-1 text-xs text-blue-900 dark:text-blue-200">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <KeyRound className="size-3.5" />
                                            <span>How to get your Bluesky App Password:</span>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground dark:text-blue-300/80 text-[11px]">
                                            Open Bluesky ➔ <span className="font-medium text-foreground">Settings ➔ Privacy and Security ➔ App Passwords ➔ Add App Password</span>.
                                        </p>
                                    </div>
                                )}

                                {isMeta && (
                                    <div className="rounded-xl border border-purple-200 bg-purple-50/60 dark:border-purple-950 dark:bg-purple-950/30 p-3 space-y-1 text-xs text-purple-900 dark:text-purple-200">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <KeyRound className="size-3.5" />
                                            <span>Page / Profile Access Token:</span>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground dark:text-purple-300/80 text-[11px]">
                                            Connect your Facebook Page or Instagram Business Profile Access Token from <span className="font-medium text-foreground">Meta Business Suite</span> to enable scheduled posts.
                                        </p>
                                    </div>
                                )}

                                {isTwitter && (
                                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 dark:border-sky-950 dark:bg-sky-950/30 p-3 space-y-1 text-xs text-sky-900 dark:text-sky-200">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <KeyRound className="size-3.5" />
                                            <span>Twitter / X API Token:</span>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground dark:text-sky-300/80 text-[11px]">
                                            Generate your Access Token / Bearer Token from the <span className="font-medium text-foreground">Twitter Developer Portal (developer.x.com)</span>.
                                        </p>
                                    </div>
                                )}

                                {isThreads && (
                                    <div className="rounded-xl border border-neutral-300 bg-neutral-100/80 dark:border-neutral-800 dark:bg-neutral-900/60 p-3 space-y-1 text-xs text-foreground">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <KeyRound className="size-3.5" />
                                            <span>Threads API Token:</span>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground text-[11px]">
                                            Get your Threads Access Token from <span className="font-medium text-foreground">Meta for Developers (Threads API)</span>.
                                        </p>
                                    </div>
                                )}

                                {isYouTube && (
                                    <div className="rounded-xl border border-red-200 bg-red-50/60 dark:border-red-950 dark:bg-red-950/30 p-3 space-y-1 text-xs text-red-900 dark:text-red-200">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <KeyRound className="size-3.5" />
                                            <span>YouTube Access Token:</span>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground dark:text-red-300/80 text-[11px]">
                                            Get your Access Token from <span className="font-medium text-foreground">Google Cloud Console</span> (YouTube Data API v3).
                                        </p>
                                    </div>
                                )}

                                {isLinkedIn && (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-950 dark:bg-blue-950/30 p-3 space-y-1 text-xs text-blue-900 dark:text-blue-200">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <KeyRound className="size-3.5" />
                                            <span>LinkedIn Access Token:</span>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground dark:text-blue-300/80 text-[11px]">
                                            Generate your Member Access Token from the <span className="font-medium text-foreground">LinkedIn Developer Portal</span>.
                                        </p>
                                    </div>
                                )}

                                {isTikTok && (
                                    <div className="rounded-xl border border-pink-200 bg-pink-50/60 dark:border-pink-950 dark:bg-pink-950/30 p-3 space-y-1 text-xs text-pink-900 dark:text-pink-200">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                            <KeyRound className="size-3.5" />
                                            <span>TikTok API Token:</span>
                                        </div>
                                        <p className="leading-relaxed text-muted-foreground dark:text-pink-300/80 text-[11px]">
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
                                                ? "e.g. animeshjain0602"
                                                : isTwitter
                                                ? "e.g. your_handle"
                                                : isThreads
                                                ? "e.g. your_threads"
                                                : isFacebook
                                                ? "e.g. DentalClinicOfficial"
                                                : "e.g. your_username"
                                        }
                                        value={handle}
                                        onChange={(e) => setHandle(e.target.value)}
                                        disabled={isLoading}
                                        required
                                        className="h-9 text-xs"
                                    />
                                </div>

                                {/* Bluesky App Password */}
                                 {isBluesky ? (
                                     <div className="space-y-1.5">
                                         <div className="flex items-center justify-between">
                                             <Label htmlFor="channel-password" className="text-xs font-semibold">
                                                 App Password {channel.has_token ? "" : "*"}
                                             </Label>
                                             {channel.has_token && (
                                                 <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                                     Password saved in DB
                                                 </span>
                                             )}
                                         </div>
                                         <Input
                                             id="channel-password"
                                             type="password"
                                             placeholder={channel.has_token ? "Password stored securely. Leave blank to keep." : "xxxx-xxxx-xxxx-xxxx"}
                                             value={password}
                                             onChange={(e) => setPassword(e.target.value)}
                                             disabled={isLoading}
                                             required={!channel.has_token}
                                             className="h-9 text-xs"
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
                                                         <span className="text-[10px] text-muted-foreground">
                                                             Optional
                                                         </span>
                                                     )}
                                                 </div>
                                                 <Input
                                                     id="channel-account-id"
                                                     placeholder={
                                                         isInstagram
                                                             ? "e.g. 17841433178455433"
                                                             : isFacebook
                                                             ? "e.g. 1000854321..."
                                                             : "e.g. 12345678"
                                                     }
                                                     value={providerAccountId}
                                                     onChange={(e) => setProviderAccountId(e.target.value)}
                                                     disabled={isLoading}
                                                     className="h-9 text-xs"
                                                 />
                                             </div>
                                         )}

                                         {/* Access Token / API Key */}
                                         <div className="space-y-1.5">
                                             <div className="flex items-center justify-between">
                                                 <Label htmlFor="channel-token" className="text-xs font-semibold">
                                                     {isMeta
                                                         ? "Page / Profile Access Token"
                                                         : isTwitter
                                                         ? "Twitter / X User Access Token or Bearer Token"
                                                         : isThreads
                                                         ? "Threads User Access Token"
                                                         : isYouTube
                                                         ? "YouTube / Google OAuth Access Token"
                                                         : isLinkedIn
                                                         ? "LinkedIn Member Access Token"
                                                         : isTikTok
                                                         ? "TikTok User Access Token"
                                                         : `${channel.name} Access Token / API Key`} {channel.has_token ? "" : "*"}
                                                 </Label>
                                                 {channel.has_token && (
                                                     <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                                         <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                         Token saved in DB
                                                     </span>
                                                 )}
                                             </div>
                                             <Input
                                                 id="channel-token"
                                                 type="password"
                                                 placeholder={channel.has_token ? "Token stored securely. Leave blank to keep." : "Paste your token or key here..."}
                                                 value={accessToken}
                                                 onChange={(e) => setAccessToken(e.target.value)}
                                                 disabled={isLoading}
                                                 required={!channel.has_token}
                                                 className="h-9 text-xs"
                                             />
                                         </div>
                                     </>
                                 )}
                            </div>
                        )}
                    </div>

                    {/* Pinned Bottom Footer */}
                    <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0 flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="text-xs h-9"
                        >
                            Cancel
                        </Button>

                        {(isBluesky || connectMode === "manual") ? (
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isLoading}
                                className="text-xs font-semibold min-w-[140px] h-9 text-white shadow-xs hover:opacity-90 transition-opacity"
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
                        ) : channel.oauth_configured === false ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setConnectMode("manual")}
                                className="text-xs font-semibold min-w-[140px] h-9 text-white shadow-xs hover:opacity-90 transition-opacity bg-primary"
                            >
                                <KeyRound className="size-3.5 mr-1.5 text-white" />
                                <span className="text-white font-medium">Use Manual Token</span>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                    window.location.href = `/api/channel/oauth?channelTypeId=${channel.id}`;
                                }}
                                className="text-xs font-semibold min-w-[140px] h-9 text-white shadow-xs hover:opacity-90 transition-opacity"
                                style={{ 
                                    backgroundColor: channel.color || "#2563eb",
                                    color: "#ffffff"
                                }}
                            >
                                <HugeiconsIcon icon={icon} className="size-3.5 mr-1.5 text-white" />
                                <span className="text-white font-medium">Connect with {channel.name}</span>
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}


