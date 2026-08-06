import { createClient } from '@insforge/sdk';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').replace(/^["']|["']$/g, '').trim();
      if (key && val && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

async function checkPosts() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  const insforge = createClient({
    baseUrl,
    anonKey: apiKey,
    isServerMode: true,
  });

  const { data: posts, error } = await insforge.database
    .from('scheduled_posts')
    .select('*, user_channels(*, channel_types(*))')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching posts:', error);
    process.exit(1);
  }

  console.log('=== RECENT SCHEDULED POSTS ===');
  for (const p of posts || []) {
    console.log({
      id: p.id,
      content: p.content,
      scheduled_at: p.scheduled_at,
      status: p.status,
      published_url: p.published_url,
      error_message: p.error_message,
      channel: p.user_channels?.channel_types?.type,
      handle: p.user_channels?.handle,
    });
  }
}

checkPosts().catch(console.error);
