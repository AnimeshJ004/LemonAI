import { getMetaAdAccounts } from "@/lib/meta-ads";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In sandbox mode (no META_CLIENT_ID), returns a demo account
    const accounts = await getMetaAdAccounts();

    return NextResponse.json({ accounts, sandbox: !process.env.META_CLIENT_ID });
  } catch (error) {
    console.error("Error fetching Meta ad accounts:", error);
    return NextResponse.json({ error: "Failed to fetch ad accounts" }, { status: 500 });
  }
}
