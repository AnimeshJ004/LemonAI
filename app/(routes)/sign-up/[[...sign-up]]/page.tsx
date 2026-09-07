"use client"
import React, { useState } from "react"
import { SignUp, useClerk, useSignIn } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { Zap } from "lucide-react"

const SignUpPage = () => {
  const [isQuickSigningUp, setIsQuickSigningUp] = useState(false)
  const { signIn } = useSignIn()
  const { setActive } = useClerk()

  const handleQuickSignUp = async () => {
    setIsQuickSigningUp(true)
    try {
      const res = await fetch("/api/auth/quick-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()
      if (!res.ok || !data.token) {
        throw new Error(data.error || "Failed to generate instant sign-up session")
      }

      toast.success("Creating your account...")

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
            toast.success("Account ready! Redirecting to Dashboard...")
            window.location.replace("/")
            return
          }
        } catch (innerErr) {
          console.warn("Client ticket activation fallback:", innerErr)
        }
      }

      // 2. Fallback redirect with ticket
      window.location.replace(`/sign-in?__clerk_ticket=${encodeURIComponent(data.token)}&redirect_url=${encodeURIComponent("/")}`)
    } catch (err: any) {
      console.error("Quick sign-up error:", err)
      toast.error(err?.message || "Failed to sign up instantly. Please use the form below.")
      setIsQuickSigningUp(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        {/* Instant 1-Click Sign-Up Card */}
        <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Zap className="size-4 text-amber-500 fill-amber-500" />
            <span>Dev &amp; Testing Instant Access</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Instantly sign up &amp; log in as{" "}
            <strong className="text-foreground">ajain4207@gmail.com</strong>{" "}
            — no password, no code, no waiting.
          </p>

          <Button
            type="button"
            size="lg"
            onClick={handleQuickSignUp}
            disabled={isQuickSigningUp}
            className="w-full font-semibold gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
          >
            {isQuickSigningUp ? (
              <>
                <Spinner className="size-4 text-white" />
                <span>Setting up account...</span>
              </>
            ) : (
              <>
                <Zap className="size-4 fill-white" />
                <span>1-Click Sign Up (ajain4207@gmail.com)</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center w-full gap-2 text-xs text-muted-foreground">
          <div className="h-px bg-border flex-1" />
          <span>or sign up manually</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <SignUp path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/" />
      </div>
    </div>
  )
}

export default SignUpPage