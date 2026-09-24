"use server"

import { clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export async function demoLoginAction() {
  const email = "vlazereigns@gmail.com"
  const client = await clerkClient()

  const users = await client.users.getUserList({ emailAddress: [email] })
  let user = users.data[0]

  if (!user) {
    user = await client.users.createUser({
      emailAddress: [email],
      skipPasswordRequirement: true,
      skipPasswordChecks: true,
    })
  }

  const token = await client.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 60,
  })

  // Detect origin dynamically — works on localhost AND production automatically
  const headersList = await headers()
  const host = headersList.get("host") || "lemon-ai-snowy.vercel.app"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const appUrl = `${proto}://${host}`

  const redirectUrl = `${token.url}${token.url.includes("?") ? "&" : "?"}redirect_url=${appUrl}/schedule`

  redirect(redirectUrl)
}
