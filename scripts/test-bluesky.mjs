import { createClient } from '@insforge/sdk';
import fs from 'fs';
import { createDecipheriv, createHash } from 'crypto';
import { BskyAgent } from '@atproto/api';

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

function decrypt(encrypted) {
  if (!encrypted) return null;
  const [iv, tag, enc] = encrypted.split('.');
  if (!iv || !tag || !enc) return null;
  const keyStr = process.env.CHANNEL_TOKEN_ENCRYPTION_KEY || 'default_token_encryption_key_32chars_lemon';
  const encryptionKey = createHash('sha256').update(keyStr).digest();
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64url')), decipher.final()]).toString('utf-8');
}

async function testBluesky() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  const insforge = createClient({
    baseUrl,
    anonKey: apiKey,
    isServerMode: true,
  });

  const { data: channel } = await insforge.database
    .from('user_channels')
    .select('*')
    .eq('id', '4c347e3a-1721-4fea-abeb-757679c3642f')
    .single();

  console.log('Bluesky channel:', {
    id: channel?.id,
    handle: channel?.handle,
    has_token: Boolean(channel?.access_token),
  });

  if (!channel) return;

  const password = decrypt(channel.access_token);
  const identifier = channel.handle?.startsWith('@') ? channel.handle.slice(1) : channel.handle;

  console.log('Trying Bluesky login with:', identifier);
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  try {
    const loginRes = await agent.login({
      identifier,
      password,
    });
    console.log('Bluesky login SUCCESS!', loginRes.data.handle);
  } catch (err) {
    console.error('Bluesky login FAILED:', err.message);
  }
}

testBluesky().catch(console.error);
