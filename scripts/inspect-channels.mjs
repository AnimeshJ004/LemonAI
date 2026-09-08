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

async function inspect() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  const insforge = createClient({
    baseUrl,
    anonKey: apiKey,
    isServerMode: true,
  });

  const { data: channels, error } = await insforge.database
    .from('user_channels')
    .select('*, channel_types(*)');

  if (error) {
    console.error('Error loading channels:', error);
    process.exit(1);
  }

  console.log(`Found ${channels?.length || 0} user channels:`);
  for (const c of channels || []) {
    console.log({
      id: c.id,
      user_id: c.user_id,
      type: c.channel_types?.type,
      name: c.channel_types?.name,
      handle: c.handle,
      is_connected: c.is_connected,
      is_active: c.is_active,
      provider_account_id: c.provider_account_id,
      has_access_token: Boolean(c.access_token),
      token_expires_at: c.token_expires_at,
    });
  }
}

inspect().catch(console.error);
