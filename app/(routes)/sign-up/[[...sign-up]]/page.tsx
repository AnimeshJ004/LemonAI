"use client"
import React from "react"
import { SignUp } from "@clerk/nextjs"

const SignUpPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <SignUp
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/onboarding"
          fallbackRedirectUrl="/onboarding"
        />
      </div>
    </div>
  )
}

export default SignUpPage
