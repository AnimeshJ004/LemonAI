import { createClient } from '@insforge/sdk';
import fs from 'fs';
import { decrypt } from '../lib/encryption.ts';

const env = fs.readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
}

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
  anonKey: process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  isServerMode: true,
});

async function main() {
  const { data: channels } = await insforge.database
    .from('user_channels')
    .select('*, channel_types(*)');

  const metaChannels = (channels || []).filter(c =>
    ['INSTAGRAM', 'FACEBOOK'].includes(c.channel_types?.type) && c.access_token
  );

  for (const ch of metaChannels) {
    console.log(`Channel: ${ch.channel_types?.type}, user: ${ch.user_id}, accountId: ${ch.provider_account_id}`);
    try {
      const token = decrypt(ch.access_token);
      console.log(`Decrypted token length: ${token?.length}, prefix: ${token?.slice(0, 10)}`);
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${ch.provider_account_id}/conversations?fields=id,participants,messages{message,from,created_time}&access_token=${token}&limit=20`
      );
      const json = await res.json();
      console.log(`Graph API status: ${res.status}, response:`, JSON.stringify(json).slice(0, 200));
    } catch (err) {
      console.log('Error testing channel:', err.message);
    }
  }
}

main();
