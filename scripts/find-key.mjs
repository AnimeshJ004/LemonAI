import { createClient } from '@insforge/sdk';
import fs from 'fs';
import { createDecipheriv, createHash } from 'crypto';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const allEnv = {};
for (const content of [env, envLocal]) {
  for (const line of content.split('\n')) {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) allEnv[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
}

const insforge = createClient({
  baseUrl: allEnv.NEXT_PUBLIC_INSFORGE_BASE_URL,
  anonKey: allEnv.INSFORGE_PROJECT_API_KEY || allEnv.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  isServerMode: true,
});

async function main() {
  const { data } = await insforge.database
    .from('user_channels')
    .select('id, user_id, access_token, channel_types(type)')
    .eq('channel_types.type', 'INSTAGRAM');

  const target = data?.find(d => d.access_token);
  if (!target) {
    console.log('No token found');
    return;
  }

  const [iv, tag, encrypted] = target.access_token.split('.');
  console.log('Testing token from user:', target.user_id);

  const candidateKeys = [
    ...Object.values(allEnv),
    'LemonAI_DevOnly_EphemeralKey_ReplaceInProduction_32chars',
    'LemonAISuperSecretTokenEncryptKey',
    'default_token_encryption_key_32chars_lemon',
    'LemonAI_BuildPhase_EphemeralKey_ReplaceInProd_32chars',
  ];

  for (const key of candidateKeys) {
    if (typeof key !== 'string' || key.length < 4) continue;
    try {
      const encryptionKey = createHash('sha256').update(key.trim()).digest();
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final()
      ]).toString('utf-8');

      console.log('SUCCESS! Key is:', key.slice(0, 8) + '...');
      console.log('Decrypted value begins with:', decrypted.slice(0, 30));
      return;
    } catch (e) {
      // ignore
    }
  }
  console.log('Failed to decrypt with all candidates');
}

main();
