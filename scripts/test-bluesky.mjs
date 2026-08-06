import { BskyAgent } from "@atproto/api";
import fs from "fs";
import path from "path";

// Simple fallback parser for .env.local if not loaded via node --env-file
if (!process.env.BLUESKY_IDENTIFIER && fs.existsSync(".env.local")) {
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

async function main() {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_APP_PASSWORD;

  if (!identifier || !password) {
    console.error("❌ Missing BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD in .env.local");
    console.error("Please add the following to your .env.local file:");
    console.error('  BLUESKY_IDENTIFIER="your-handle.bsky.social"');
    console.error('  BLUESKY_APP_PASSWORD="your-app-password"');
    process.exit(1);
  }

  console.log(`Connecting to Bluesky as ${identifier}...`);
  const agent = new BskyAgent({ service: "https://bsky.social" });

  await agent.login({ identifier, password });
  console.log("✅ Authenticated successfully!");

  const postText = `Hello from AI Social Media Scheduler! 🚀 (${new Date().toLocaleTimeString()})`;
  console.log(`Posting: "${postText}"`);

  const result = await agent.post({
    text: postText,
    createdAt: new Date().toISOString(),
  });

  console.log("\n🎉 Post published successfully to Bluesky!");
  console.log("URI:", result.uri);
  console.log("CID:", result.cid);
  
  const rkey = result.uri.split("/").pop();
  const cleanHandle = identifier.startsWith("@") ? identifier.slice(1) : identifier;
  console.log(`🔗 View post online: https://bsky.app/profile/${cleanHandle}/post/${rkey}`);
}

main().catch((err) => {
  console.error("❌ Failed to post to Bluesky:", err.message || err);
  process.exit(1);
});
