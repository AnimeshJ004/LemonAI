import { createClient } from '@insforge/sdk';
import fs from 'fs';
import { createHash, createCipheriv } from 'crypto';

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
  const iv = Buffer.from('4a5f6e8b9c1d2e3f4a5b6c7d', 'hex'); // 12 bytes
  const keyStr = process.env.CHANNEL_TOKEN_ENCRYPTION_KEY || 'LemonAISuperSecretTokenEncryptKey';
  const encryptionKey = createHash('sha256').update(keyStr).digest();
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

async function updateChannel() {
  const pageAccessToken = 'EAAj8NdgwzwsBSU1VefD6JxZCbfO0OCIrzn4fdnZC7J9HhNPpuZA0imxEqKl7oubtwNZBEftVKTi6KMa5jJnsyZBXLA3SjbIxK81rXXNOkbnH5O1Mc5LZBhwhnAgCg41f0A7orPQlGIHZB58Lqns3tBfY9BfAUeFFhV2pZCcKRmSqmDnmdIjQwx4ELZCGpqeS2EDwvE9HF';
  const pageId = '1308682348996283';
  const pageName = 'Lemonai';

  const insforge = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.INSFORGE_PROJECT_API_KEY,
    isServerMode: true,
  });

  const encryptedToken = encrypt(pageAccessToken);

  // Update user_3J2WOEtnIyxRczSqheABFPZ8Sht Facebook channel
  const { data, error } = await insforge.database
    .from('user_channels')
    .update({
      provider_account_id: pageId,
      handle: pageName,
      access_token: encryptedToken,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '3cef9748-822b-4a29-b37b-2f2e5651a43f')
    .select();

  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('✅ Successfully updated Facebook channel for user_3J2WOEtnIyxRczSqheABFPZ8Sht:', data);
  }

  // Also update user_3IqXxcE9tuYPIJtzgTFXRe0QISc if present
  await insforge.database
    .from('user_channels')
    .update({
      provider_account_id: pageId,
      handle: pageName,
      access_token: encryptedToken,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'f7512433-57e7-425f-a0f3-56d997e0e4e5');

  // Also update user_3HRbFrpsGp0zzFigXIM6qeh6NF0 if present
  await insforge.database
    .from('user_channels')
    .update({
      provider_account_id: pageId,
      handle: pageName,
      access_token: encryptedToken,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '4f6dc7a2-952b-4572-b78b-c31de3a70346');
}

updateChannel().catch(console.error);
