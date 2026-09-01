import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const email = "ajain4207@gmail.com";
        const client = await clerkClient();

        // 1. Fetch user by email
        const userList = await client.users.getUserList({
            emailAddress: [email],
        });

        let user = userList.data?.[0];

        // 2. If user doesn't exist yet, create user in Clerk
        if (!user) {
            user = await client.users.createUser({
                emailAddress: [email],
                skipPasswordRequirement: true,
                firstName: "Animesh",
            });
        }

        // 3. Create sign-in token (ticket)
        const tokenResponse = await client.signInTokens.createSignInToken({
            userId: user.id,
            expiresInSeconds: 60 * 10,
        });

        return NextResponse.json({
            token: tokenResponse.token,
            url: tokenResponse.url,
            userId: user.id,
        });
    } catch (error: any) {
        console.error("Quick login token generation error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to generate quick login token" },
            { status: 500 }
        );
    }
}
