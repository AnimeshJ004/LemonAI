"use client"
import React from "react"
import { SignIn } from "@clerk/nextjs"
import { demoLoginAction } from "../demo-action"
import { Button } from "@/components/ui/button"

const SignInPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <SignIn
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/schedule"
          fallbackRedirectUrl="/schedule"
          initialValues={{ emailAddress: "vlazereigns@gmail.com" }}
        />
        <form action={demoLoginAction} className="w-full">
          <Button type="submit" variant="outline" className="w-full mt-2">
            Quick Demo Login (vlazereigns@gmail.com)
          </Button>
        </form>
      </div>
    </div>
  )
}

export default SignInPage
