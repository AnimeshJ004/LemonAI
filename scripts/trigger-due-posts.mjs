import { Inngest } from "inngest";
import { createClient } from "@insforge/sdk";
import fs from "fs";

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

async function trigger() {
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
    .select("id, content, scheduled_at, user_channels(*, channel_types(*))")
    .eq("status", "queue")
    .lte("scheduled_at", now);

  if (error || !posts) {
    console.error("Error loading queued posts:", error);
    process.exit(1);
  }

  console.log(`Found ${posts.length} due posts in queue:`);
  for (const p of posts) {
    console.log(`- Post ID: ${p.id} | Content: "${p.content}" | Channel: ${p.user_channels?.channel_types?.type}`);
  }

  const inngest = new Inngest({ id: "lemon-ai-social-scheduling" });

  const events = posts.map((p) => ({
    name: "post/publish.requested",
    data: { postId: p.id },
  }));

  console.log("Sending publish events to Inngest...");
  await inngest.send(events);
  console.log("✅ Successfully sent publish events to Inngest dev server!");
}

trigger().catch(console.error);
