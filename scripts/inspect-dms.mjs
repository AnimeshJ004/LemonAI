import { createClient } from '@insforge/sdk';
import fs from 'fs';

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

async function main() {
  const { data, error } = await insforge.database.from('social_dms').select('*');
  console.log('social_dms error:', error);
  console.log('social_dms count:', data?.length);
  if (data && data.length > 0) {
    console.log('sample row:', data[0]);
  }
}

main();
