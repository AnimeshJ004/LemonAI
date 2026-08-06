import { BskyAgent } from "@atproto/api";
import { createClient } from "@insforge/sdk";
import fs from "fs";
import { createCipheriv, createDecipheriv, createHash } from "crypto";

if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "").trim();
      if (key && val && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

function decrypt(encrypted) {
  if (!encrypted) return null;
  const [iv, tag, enc] = encrypted.split(".");
  if (!iv || !tag || !enc) return null;
  const keyStr = process.env.CHANNEL_TOKEN_ENCRYPTION_KEY || "default_token_encryption_key_32chars_lemon";
  const encryptionKey = createHash("sha256").update(keyStr).digest();
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf-8");
}

async function publishQueuedBlueskyPosts() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  const insforge = createClient({
    baseUrl,
    anonKey: apiKey,
    isServerMode: true,
  });

  const now = new Date().toISOString();
  const { data: posts, error } = await insforge.database
    .from("scheduled_posts")
    .select("*, user_channels(*, channel_types(*))")
    .eq("status", "queue")
    .lte("scheduled_at", now);

  if (error || !posts) {
    console.error("Error fetching queued posts:", error);
    process.exit(1);
  }

  const blueskyPosts = posts.filter(
    (p) => p.user_channels?.channel_types?.type === "BLUESKY"
  );

  console.log(`Found ${blueskyPosts.length} queued Bluesky posts to publish...`);

  for (const post of blueskyPosts) {
    console.log(`\nPublishing post ID: ${post.id}`);
    console.log(`Content: "${post.content}"`);

    const handle = post.user_channels?.handle || process.env.BLUESKY_IDENTIFIER;
    const encryptedToken = post.user_channels?.access_token;
    const password = decrypt(encryptedToken) || process.env.BLUESKY_APP_PASSWORD;

    if (!handle || !password) {
      console.error("❌ Missing handle or password for Bluesky post");
      continue;
    }

    const cleanIdentifier = handle.replace(/^@/, "").trim();
    const agent = new BskyAgent({ service: "https://bsky.social" });

    try {
      await agent.login({ identifier: cleanIdentifier, password });
      console.log(`Logged in as ${cleanIdentifier}`);

      const result = await agent.post({
        text: post.content,
        createdAt: new Date().toISOString(),
      });

      const rkey = result.uri.split("/").pop();
      const publishedUrl = `https://bsky.app/profile/${cleanIdentifier}/post/${rkey}`;
      console.log(`🎉 Published successfully! Link: ${publishedUrl}`);

      // Update database status to published
      await insforge.database
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_url: publishedUrl,
        })
        .eq("id", post.id);

      console.log(`Updated post status in database to 'published'.`);
    } catch (err) {
      console.error(`❌ Failed to publish post ${post.id}:`, err);
    }
  }
}

publishQueuedBlueskyPosts().catch(console.error);
