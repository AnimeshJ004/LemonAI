import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getInsforgeUploadClient } from "@/lib/insforge-server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imageBase64, filename } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "Missing imageBase64 data" }, { status: 400 });
    }

    // Extract base64 payload
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let contentType = "image/png";

    if (matches && matches.length === 3) {
      contentType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
    } else {
      buffer = Buffer.from(imageBase64, "base64");
    }

    const storageKey = `creatives/${userId}/${Date.now()}-${filename || "branded-insta-post.png"}`;

    try {
      const insforge = getInsforgeUploadClient();
      const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
      const { data, error } = await insforge.storage.from("lemon").upload(storageKey, blob as any);

      if (!error && data?.url) {
        return NextResponse.json({
          success: true,
          url: data.url,
          storageKey,
        });
      }
    } catch (storageErr) {
      console.warn("[Upload Client Error]", storageErr);
    }

    // Fallback: return as valid data URL if storage upload failed or not configured
    return NextResponse.json({
      success: true,
      url: imageBase64,
      storageKey,
      note: "Served as base64 payload",
    });
  } catch (error: any) {
    console.error("[Upload Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload image" },
      { status: 500 }
    );
  }
}
