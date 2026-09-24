"use server"

import { clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

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

  // Redirect back to our app's dashboard after Clerk sign in
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const redirectUrl = `${token.url}${token.url.includes('?') ? '&' : '?'}redirect_url=${appUrl}/schedule`

  redirect(redirectUrl)
}
