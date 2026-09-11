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

function decryptWithKey(encryptedText, key) {
  if (!encryptedText) return null;
  const parts = encryptedText.split('.');
  if (parts.length !== 3) return encryptedText;
  const [iv, tag, enc] = parts;
  try {
    const encryptionKey = createHash('sha256').update(key.trim()).digest();
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(enc, 'base64url')),
      decipher.final()
    ]).toString('utf-8');
  } catch {
    return null;
  }
}

async function main() {
  const { data } = await insforge.database
    .from('user_channels')
    .select('*, channel_types(type, name)');

  const keys = [
    'LemonAISuperSecretTokenEncryptKey',
    'LemonAI_DevOnly_EphemeralKey_ReplaceInProduction_32chars',
    'default_token_encryption_key_32chars_lemon'
  ];

  for (const row of data || []) {
    let dec = null;
    let usedKey = null;
    for (const k of keys) {
      dec = decryptWithKey(row.access_token, k);
      if (dec) { usedKey = k; break; }
    }
    console.log(`[${row.channel_types?.type}] user: ${row.user_id}, handle: ${row.handle}, connected: ${row.is_connected}`);
    console.log(`  Decrypted: ${dec ? (dec.slice(0, 25) + '...') : 'FAILED TO DECRYPT'}`);
  }
}

main();
