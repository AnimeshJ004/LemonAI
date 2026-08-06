import { createClient } from '@insforge/sdk';
import fs from 'fs';
import { createCipheriv, createHash, randomBytes } from 'crypto';

// Load .env.local
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

function encrypt(text) {
  if (!text) return null;
  const keyStr = process.env.CHANNEL_TOKEN_ENCRYPTION_KEY || 'default_token_encryption_key_32chars_lemon';
  const iv = randomBytes(12);
  const encryptionKey = createHash('sha256').update(keyStr).digest();
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

async function fix() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  const bskyHandle = process.env.BLUESKY_IDENTIFIER || 'testaipost.bsky.social';
  const formattedHandle = bskyHandle.startsWith('@') ? bskyHandle : `@${bskyHandle}`;
  const encryptedPass = encrypt(process.env.BLUESKY_APP_PASSWORD || 'qe4m-ztqb-tlbp-pdxz');

  console.log(`Connecting to Insforge at ${baseUrl}...`);
  const insforge = createClient({
    baseUrl,
    anonKey: apiKey,
    isServerMode: true,
  });

  // Get BLUESKY channel_type id
  const { data: channelTypes, error: ctErr } = await insforge.database
    .from('channel_types')
    .select('id, type')
    .eq('type', 'BLUESKY');

  if (ctErr || !channelTypes || channelTypes.length === 0) {
    console.error('Failed to get BLUESKY channel type:', ctErr);
    process.exit(1);
  }

  const bskyTypeId = channelTypes[0].id;
  console.log(`Found BLUESKY channel_type_id: ${bskyTypeId}`);

  // Update all existing user_channels rows for BLUESKY
  const { data: updated, error: updateErr } = await insforge.database
    .from('user_channels')
    .update({
      handle: formattedHandle,
      access_token: encryptedPass,
      is_connected: true,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('channel_type_id', bskyTypeId)
    .select();

  if (updateErr) {
    console.error('Error updating user_channels:', updateErr);
    process.exit(1);
  }

  console.log('✅ Successfully updated user_channels in database:');
  console.log(JSON.stringify(updated, null, 2));
}

fix().catch(console.error);
