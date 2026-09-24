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

  // Clerk's dev token URL is hardcoded to localhost — replace it with the real host
  const headersList = await headers()
  const host = headersList.get("host") || "lemon-ai-snowy.vercel.app"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const appUrl = `${proto}://${host}`

  // token.url looks like: http://localhost:3000/?_clerk_db_jwt=xxx
  // We replace localhost:3000 with the actual host so it works on Vercel
  let clerkUrl = token.url
  clerkUrl = clerkUrl.replace(/https?:\/\/localhost:\d+/, appUrl)
  clerkUrl = clerkUrl.replace(/https?:\/\/127\.0\.0\.1:\d+/, appUrl)

  // Ensure the final redirect lands on the dashboard
  const separator = clerkUrl.includes("?") ? "&" : "?"
  const finalUrl = `${clerkUrl}${separator}redirect_url=${appUrl}/schedule`

  redirect(finalUrl)
}
