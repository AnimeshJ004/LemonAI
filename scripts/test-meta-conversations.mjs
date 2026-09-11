import { createClient } from '@insforge/sdk';
import fs from 'fs';
import { createDecipheriv, createHash } from 'crypto';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const allEnv = {};
for (const line of envLocal.split('\n')) {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) allEnv[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
}

const insforge = createClient({
  baseUrl: allEnv.NEXT_PUBLIC_INSFORGE_BASE_URL,
  anonKey: allEnv.INSFORGE_PROJECT_API_KEY || allEnv.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  isServerMode: true,
});

function decryptToken(encryptedText) {
  if (!encryptedText) return null;
  const parts = encryptedText.split('.');
  if (parts.length !== 3) return encryptedText;
  const [iv, tag, enc] = parts;
  const key = 'LemonAISuperSecretTokenEncryptKey';
  try {
    const encryptionKey = createHash('sha256').update(key).digest();
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(enc, 'base64url')),
      decipher.final()
    ]).toString('utf-8');
  } catch (e) {
    return null;
  }
}

async function testTokens() {
  const { data } = await insforge.database
    .from('user_channels')
    .select('*, channel_types(type)');

  const metaChannels = (data || []).filter(c => ['INSTAGRAM', 'FACEBOOK'].includes(c.channel_types?.type));

  for (const ch of metaChannels) {
    const token = decryptToken(ch.access_token);
    if (!token) continue;
    console.log(`Testing ${ch.channel_types?.type} (${ch.handle}, accountId: ${ch.provider_account_id})...`);
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${ch.provider_account_id}/conversations?fields=id,participants,messages{message,from,created_time}&access_token=${token}&limit=5`
    );
    const json = await res.json();
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      console.log(`  Conversations count: ${json.data?.length || 0}`);
    } else {
      console.log(`  Error: ${JSON.stringify(json.error?.message)}`);
    }
  }
}

testTokens();
