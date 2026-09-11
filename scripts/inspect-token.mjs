import { createClient } from '@insforge/sdk';
import fs from 'fs';

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
  const { data } = await insforge.database
    .from('user_channels')
    .select('id, user_id, access_token, channel_types(type)');
  data.forEach(d => {
    console.log(
      d.channel_types?.type,
      'user:', d.user_id,
      'token_len:', d.access_token?.length,
      'dots:', d.access_token ? d.access_token.split('.').length - 1 : 0
    );
  });
}

main();
