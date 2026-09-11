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
  const res = await insforge.database
    .from('user_channels')
    .select('*, channel_types(type)')
    .in('channel_types.type', ['INSTAGRAM', 'FACEBOOK']);
  console.log('Result with channel_types.type:', res.error ? 'ERROR: ' + JSON.stringify(res.error) : `Data count: ${res.data?.length}`);

  const res2 = await insforge.database
    .from('user_channels')
    .select('*, channel_types(type)');
  console.log('Result without in filter:', res2.error ? 'ERROR: ' + JSON.stringify(res2.error) : `Data count: ${res2.data?.length}`);
}

main();
