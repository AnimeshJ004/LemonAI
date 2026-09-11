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
  const tables = ['user_channels', 'social_comments', 'scheduled_posts', 'brand_profiles', 'leads', 'crm_conversations', 'crm_messages', 'crm_activities'];
  for (const t of tables) {
    const res = await insforge.database.from(t).select('*').limit(1);
    if (res.error) {
      console.log(`❌ ${t}: MISSING (${res.error.message})`);
    } else {
      console.log(`✅ ${t}: EXISTS`);
    }
  }
}

main().catch(console.error);
