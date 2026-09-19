"use client"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserProfile, useUser } from "@clerk/nextjs"
import { Layers, Palette, User } from "lucide-react"
import ChannelsTab from "@/components/settings/channels-tab"
import { useTheme } from "next-themes"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ModernLoader } from "@/components/ui/modern-loader"

function SettingsContent() {
  const { user } = useUser()
  const { theme, setTheme } = useTheme()
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabParam = searchParams.get("tab") || "channels"
  const [activeTab, setActiveTab] = useState(tabParam)

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = (val: string) => {
    setActiveTab(val)
    router.replace(`/settings?tab=${val}`, { scroll: false })
  }

  return (
    <div className="w-full min-w-0">
      <div className="max-w-5xl mx-auto w-full h-full">
        <div className="py-2 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Settings & Preferences</h1>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 md:line-clamp-none mt-0.5">
            Configure your account profile, social channels, and theme appearance
          </p>
        </div>

        <div>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="mb-4 sm:mb-6 w-full border-b overflow-x-auto">
              <TabsList variant="line" className="w-fit space-x-2 sm:space-x-4 min-h-[44px]">
                <TabsTrigger value="profile" className="min-h-[44px] gap-2 px-3 text-xs sm:text-sm">
                  <User className="size-4" />
                  <span>Profile</span>
                </TabsTrigger>
                <TabsTrigger value="channels" className="min-h-[44px] gap-2 px-3 text-xs sm:text-sm">
                  <Layers className="size-4" />
                  <span>Channels</span>
                </TabsTrigger>
                <TabsTrigger value="appearance" className="min-h-[44px] gap-2 px-3 text-xs sm:text-sm">
                  <Palette className="size-4" />
                  <span>Appearance</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Your Profile
                  </CardTitle>
                  <CardDescription>Manage your account information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt="Profile"
                        className="h-16 w-16 rounded-full"
                        width={64}
                        height={64}
                      />
                    ):(
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <User className="size-8 text-muted-foreground" />
                      </div>
                    )}

                    <div>
                      <p className="font-medium">{user?.fullName || "No name set"}</p>
                      <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                  </div>
                   <div className="mt-6">
                    <UserProfile
                      routing="hash"
                      appearance={{
                        elements: {
                          rootBox: "w-full",
                          card: "border-0 shadow-none",
                        },
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="channels">
              <ChannelsTab  />
            </TabsContent>

            <TabsContent value="appearance">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize how Lemon AI looks for you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="theme">Dark mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Toggle between light and dark theme
                      </p>
                    </div>
                    <Switch
                      id="theme"
                      checked={theme === "dark"}
                      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

const SettingsPage = () => {
  return (
    <Suspense fallback={<ModernLoader showSkeleton label="Loading settings" description="Retrieving connected channels & preferences" />}>
      <SettingsContent />
    </Suspense>
  )
}

export default SettingsPage