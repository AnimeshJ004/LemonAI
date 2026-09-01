"use client"
import React, { useState } from "react"
import { SignIn, useClerk, useSignIn } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { Zap } from "lucide-react"

const SignInPage = () => {
  const [isQuickLoggingIn, setIsQuickLoggingIn] = useState(false)
  const { signIn } = useSignIn()
  const { setActive } = useClerk()

  const handleQuickLogin = async () => {
    setIsQuickLoggingIn(true)
    try {
      const res = await fetch("/api/auth/quick-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()
      if (!res.ok || !data.token) {
        throw new Error(data.error || "Failed to generate instant login session")
      }

      toast.success("Authenticating session...")

      // 1. Direct client session creation and activation
      if (signIn && setActive) {
        try {
          const result: any = await (signIn as any).create({
            strategy: "ticket",
            ticket: data.token,
          })

          const sessionId = result?.createdSessionId || result?.sessionId
          if (sessionId) {
            await (setActive as any)({ session: sessionId })
            toast.success("Logged in successfully! Redirecting to Dashboard...")
            window.location.replace("/")
            return
          }
        } catch (innerErr) {
          console.warn("Client ticket activation fallback:", innerErr)
        }
      }

      // 2. In-app fallback staying strictly on local domain / dashboard
      window.location.replace(`/sign-in?__clerk_ticket=${encodeURIComponent(data.token)}&redirect_url=${encodeURIComponent("/")}`)
    } catch (err: any) {
      console.error("Quick login error:", err)
      toast.error(err?.message || "Failed to login instantly. Please use password below.")
      setIsQuickLoggingIn(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        {/* Instant 1-Click Login Card */}
        <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Zap className="size-4 text-amber-500 fill-amber-500" />
            <span>Dev & Testing Instant Access</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Directly log in to <strong className="text-foreground">ajain4207@gmail.com</strong> without entering any password or code.
          </p>

          <Button
            type="button"
            size="lg"
            onClick={handleQuickLogin}
            disabled={isQuickLoggingIn}
            className="w-full font-semibold gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
          >
            {isQuickLoggingIn ? (
              <>
                <Spinner className="size-4 text-white" />
                <span>Logging in instantly...</span>
              </>
            ) : (
              <>
                <Zap className="size-4 fill-white" />
                <span>1-Click Instant Login (ajain4207@gmail.com)</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center w-full gap-2 text-xs text-muted-foreground">
          <div className="h-px bg-border flex-1" />
          <span>or sign in manually</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <SignIn 
          path="/sign-in" 
          signUpUrl="/sign-up" 
          forceRedirectUrl="/" 
          initialValues={{
            emailAddress: "ajain4207@gmail.com"
          }}
        />
      </div>
    </div>
  )
}

export default SignInPage