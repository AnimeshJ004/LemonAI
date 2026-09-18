"use client"
import React from "react"
import { SignIn } from "@clerk/nextjs"

const SignInPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <SignIn
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/schedule"
          fallbackRedirectUrl="/schedule"
        />
      </div>
    </div>
  )
}

export default SignInPage
