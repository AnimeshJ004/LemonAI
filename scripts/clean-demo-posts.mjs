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

async function cleanDemoPosts() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  const insforge = createClient({
    baseUrl,
    anonKey: apiKey,
    isServerMode: true,
  });

  console.log("Cleaning old unconnected demo posts from scheduled_posts table...");

  const { data: userChannels } = await insforge.database
    .from("user_channels")
    .select("id")
    .eq("is_connected", false);

  const unconnectedIds = (userChannels || []).map((uc) => uc.id);

  if (unconnectedIds.length > 0) {
    const { data: deleted, error } = await insforge.database
      .from("scheduled_posts")
      .delete()
      .in("user_channel_id", unconnectedIds)
      .select();

    if (error) {
      console.error("Error deleting demo posts:", error);
    } else {
      console.log(`✅ Removed ${deleted?.length || 0} old demo posts with missing credentials.`);
    }
  } else {
    console.log("No unconnected demo channels found.");
  }
}

cleanDemoPosts().catch(console.error);
