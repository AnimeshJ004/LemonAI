import { createClient } from '@insforge/sdk';
import fs from 'fs';
import { createHash, createDecipheriv } from 'crypto';

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

const KNOWN_KEYS = [
  process.env.CHANNEL_TOKEN_ENCRYPTION_KEY,
  "LemonAISuperSecretTokenEncryptKey",
  "LemonAI_DevOnly_EphemeralKey_ReplaceInProduction_32chars",
  "default_token_encryption_key_32chars_lemon",
  process.env.CLERK_SECRET_KEY,
  process.env.INSFORGE_PROJECT_API_KEY,
].filter(Boolean);

function decrypt(encrypted) {
  if (!encrypted) return null;
  const parts = encrypted.split(".");
  if (parts.length !== 3) return encrypted;
  const [iv, tag, encryted] = parts;
  if (!iv || !tag || !encryted) return encrypted;

  for (const keyStr of KNOWN_KEYS) {
    try {
      const encryptionKey = createHash("sha256").update(keyStr).digest();
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryted, "base64url")),
        decipher.final()
      ]);
      return decrypted.toString("utf-8");
    } catch (err) {
      console.log(`Key ${keyStr ? keyStr.slice(0, 10) : 'null'} error:`, err.message);
      continue;
    }
  }
  console.warn("[Encryption] Could not decrypt token with active keys!");
  return encrypted;
}

async function testFb() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_PROJECT_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  const insforge = createClient({
    baseUrl,
    anonKey: apiKey,
    isServerMode: true,
  });

  const { data: channels, error } = await insforge.database
    .from('user_channels')
    .select('*, channel_types(*)')
    .eq('is_connected', true);

  const fbChannels = (channels || []).filter(c => c.channel_types?.type === 'FACEBOOK');
  console.log(`Found ${fbChannels.length} connected Facebook channels`);

  for (const fb of fbChannels) {
    console.log('\n--- Testing Facebook Channel:', fb.handle, 'ID:', fb.provider_account_id, 'User:', fb.user_id);
    console.log('Raw token in DB:', fb.access_token ? fb.access_token.slice(0, 40) : null);
    const token = decrypt(fb.access_token);
    console.log('Decrypted token preview:', token ? `${token.slice(0, 20)}... len=${token.length}` : 'null');
    if (!token) {
      console.log('No token');
      continue;
    }

    // 1. Check /me
    try {
      const meRes = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
      const meData = await meRes.json();
      console.log('GET /me result:', meData);
    } catch (e) {
      console.log('GET /me error:', e.message);
    }

    // 2. Check /me/accounts
    try {
      const accRes = await fetch(`https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,tasks&access_token=${encodeURIComponent(token)}`);
      const accData = await accRes.json();
      console.log('GET /me/accounts result:', accData);
    } catch (e) {
      console.log('GET /me/accounts error:', e.message);
    }

    // 4. Test querying the known Facebook Page 1308682348996283 with the user token
    try {
      const pageRes = await fetch(`https://graph.facebook.com/v22.0/1308682348996283?fields=id,name,access_token&access_token=${encodeURIComponent(token)}`);
      const pageData = await pageRes.json();
      console.log('Query Page /1308682348996283 result:', pageData);

      if (pageData.access_token) {
        console.log('✅ Obtained Page Access Token for Page:', pageData.name, pageData.id);
        const testPostRes = await fetch(`https://graph.facebook.com/v22.0/1308682348996283/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '🚀 Hello from Lemon AI! Auto-scheduler is connected and working.',
            access_token: pageData.access_token,
          })
        });
        const testPostData = await testPostRes.json();
        console.log('Post to Facebook Page result:', testPostData);
      }
    } catch (e) {
      console.log('Query Page error:', e.message);
    }
  }
}

testFb().catch(console.error);
