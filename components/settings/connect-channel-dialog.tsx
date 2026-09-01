"use client"
import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChannelType } from "@/types/channel.type"
import { ChannelTypeEnum, getChannelIcon } from "@/constants/channels"
import { HugeiconsIcon } from "@hugeicons/react"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { KeyRound, Sparkles, ShieldCheck, CheckCircle2, Lock, ArrowRight, ExternalLink } from "lucide-react"

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
    const [activeTab, setActiveTab] = useState("oauth")

    if (!channel) return null

    const icon = getChannelIcon(channel.type)
    const isBluesky = channel.type === ChannelTypeEnum.BLUESKY
    const isInstagram = channel.type === ChannelTypeEnum.INSTAGRAM
    const isFacebook = channel.type === ChannelTypeEnum.FACEBOOK
    const isTwitter = channel.type === ChannelTypeEnum.TWITTER
    const isLinkedIn = channel.type === ChannelTypeEnum.LINKEDIN

    // 1-Click Official OAuth Flow (Meta Business / Twitter / LinkedIn)
    const handleOfficialOAuthConnect = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/channel/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelTypeId: channel.id,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "Failed to initiate official authorization")
            }

            if (data.isOAuth && data.url) {
                window.location.assign(data.url)
            } else if (data.connected) {
                toast.success(`Connected ${channel.name} account successfully!`)
                onSuccess?.()
                onOpenChange(false)
            }
        } catch (err: any) {
            console.error("OAuth error:", err)
            toast.error(err?.message || "Failed to start official login")
        } finally {
            setIsLoading(false)
        }
    }

    // Direct Credentials Verification (e.g. Bluesky App Password or Meta System User Token)
    const handleConnectManual = async () => {
        if (isBluesky && !password.trim()) {
            toast.error("Please enter your Bluesky App Password")
            return
        }

        if (!isBluesky && !handle.trim() && !accessToken.trim()) {
            toast.error("Please provide your account handle or access token")
            return
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
                    isManual: true,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "Failed to connect channel")
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
            toast.error(err?.message || "Failed to connect channel")
        } finally {
            setIsLoading(false)
        }
    }

    const handleQuickDemoConnect = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/channel/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelTypeId: channel.id,
                    isDemo: true,
                }),
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "Failed to connect demo channel")
            }

            toast.success(`Connected demo ${channel.name} account!`)
            onSuccess?.()
            onOpenChange(false)
        } catch (err: any) {
            toast.error(err?.message || "Failed to connect demo channel")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-6">
                <DialogHeader className="space-y-3 pb-2 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {icon && (
                                <HugeiconsIcon
                                    icon={icon}
                                    color="currentColor"
                                    className="text-white size-9 p-2 rounded-xl shrink-0 shadow-sm"
                                    style={{ background: channel.color || "#000" }}
                                />
                            )}
                            <div>
                                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                    <span>Connect {channel.name}</span>
                                    {(isInstagram || isFacebook) && (
                                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                            Meta Business
                                        </span>
                                    )}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Enterprise security with AES-256 token encryption
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                            <ShieldCheck className="size-3.5" />
                            <span>Encrypted</span>
                        </div>
                    </div>
                </DialogHeader>

                {isBluesky ? (
                    /* Bluesky Direct In-App Verification */
                    <div className="space-y-4 py-3">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-950 dark:bg-blue-950/30 p-3.5 space-y-1.5 text-xs text-blue-900 dark:text-blue-200">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <KeyRound className="size-3.5" />
                                <span>Direct Bluesky Authentication:</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground dark:text-blue-300/80">
                                In your Bluesky app:{" "}
                                <span className="font-medium text-foreground">Settings ➔ Privacy & Security ➔ App Passwords</span>{" "}
                                and create an App Password.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="channel-handle" className="text-xs font-semibold">
                                Bluesky Handle / Email
                            </Label>
                            <Input
                                id="channel-handle"
                                placeholder="e.g. username.bsky.social"
                                value={handle}
                                onChange={(e) => setHandle(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="channel-password" className="text-xs font-semibold">
                                App Password
                            </Label>
                            <Input
                                id="channel-password"
                                type="password"
                                placeholder="xxxx-xxxx-xxxx-xxxx"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>

                        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleQuickDemoConnect}
                                disabled={isLoading}
                                className="text-xs"
                            >
                                <Sparkles className="size-3.5 mr-1 text-amber-500" />
                                Demo Account
                            </Button>

                            <Button
                                type="button"
                                size="sm"
                                onClick={handleConnectManual}
                                disabled={isLoading}
                                className="text-xs font-medium"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner className="size-3.5 mr-1.5" />
                                        <span>Verifying Credentials...</span>
                                    </>
                                ) : (
                                    <span>Verify & Connect Bluesky</span>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    /* Enterprise Multi-Tab (OAuth vs Direct System User Token) for Instagram, Facebook, LinkedIn, Twitter */
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
                        <TabsList className="grid grid-cols-2 w-full mb-3">
                            <TabsTrigger value="oauth" className="text-xs">
                                🔒 1-Click Business Login
                            </TabsTrigger>
                            <TabsTrigger value="manual" className="text-xs">
                                🔑 Meta Token / API Key
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="oauth" className="space-y-4">
                            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-foreground">
                                        Authorized Business & Ads Permissions:
                                    </p>
                                    <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                            <span>Organic Posts, Reels & Carousel Publishing</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                            <span>Meta Ads Management & Campaign Insights</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                            <span>Page & Instagram Business Account Linkage</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="button"
                                size="default"
                                onClick={handleOfficialOAuthConnect}
                                disabled={isLoading}
                                className="w-full text-xs font-semibold gap-2 shadow-sm"
                                style={{ background: channel.color || "#1877F2" }}
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner className="size-4 text-white" />
                                        <span>Redirecting to {channel.name}...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Continue with Official {channel.name} Login</span>
                                        <ArrowRight className="size-4" />
                                    </>
                                )}
                            </Button>
                        </TabsContent>

                        <TabsContent value="manual" className="space-y-3.5">
                            <div className="space-y-1.5">
                                <Label htmlFor="business-handle" className="text-xs font-semibold">
                                    Account Handle or Page Name
                                </Label>
                                <Input
                                    id="business-handle"
                                    placeholder="e.g. @yourbusiness or DentalClinicOfficial"
                                    value={handle}
                                    onChange={(e) => setHandle(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="business-account-id" className="text-xs font-semibold">
                                    Instagram / Facebook Business ID (Optional)
                                </Label>
                                <Input
                                    id="business-account-id"
                                    placeholder="e.g. 17841400000000000"
                                    value={providerAccountId}
                                    onChange={(e) => setProviderAccountId(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="business-token" className="text-xs font-semibold">
                                        System User Access Token / API Key
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground">Encrypted with AES-256</span>
                                </div>
                                <Input
                                    id="business-token"
                                    type="password"
                                    placeholder="Paste EAAB... Meta Graph token or Bearer token"
                                    value={accessToken}
                                    onChange={(e) => setAccessToken(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleQuickDemoConnect}
                                    disabled={isLoading}
                                    className="text-xs"
                                >
                                    <Sparkles className="size-3.5 mr-1 text-amber-500" />
                                    Demo Connect
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleConnectManual}
                                    disabled={isLoading}
                                    className="text-xs font-medium"
                                >
                                    {isLoading ? (
                                        <>
                                            <Spinner className="size-3.5 mr-1.5" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>Save & Connect Account</span>
                                    )}
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}

