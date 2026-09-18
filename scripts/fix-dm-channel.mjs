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

const STALE = 'cae8e044-6ab5-44ae-9838-52f87e14a976';
const GOOD = '6ab2fa5c-b6a7-4380-9539-cadd194bfd64';

// Step 1: repoint any posts on the stale row to the good row
const { data: updated, error: upErr } = await insforge.database
  .from('scheduled_posts')
  .update({ user_channel_id: GOOD })
  .eq('user_channel_id', STALE)
  .select('id');
console.log('Repointed posts:', updated?.length, 'error:', upErr?.message);

// Step 2: verify nothing else references the stale row
const { data: stillRef } = await insforge.database
  .from('scheduled_posts')
  .select('id')
  .eq('user_channel_id', STALE);
console.log('Posts still referencing stale row after repoint:', stillRef?.length);

// Step 3: delete the stale duplicate channel row
if ((stillRef?.length || 0) === 0) {
  const { error: delErr } = await insforge.database
    .from('user_channels')
    .delete()
    .eq('id', STALE);
  console.log('Deleted stale channel row. error:', delErr?.message);
} else {
  console.log('Skipping delete — stale row still referenced.');
}

// Step 4: confirm only one IG row remains for this account, and it has page creds
const { data: remaining } = await insforge.database
  .from('user_channels')
  .select('id, page_id, page_access_token, channel_types(type)')
  .eq('provider_account_id', '17841433178455433');
console.log('Remaining IG rows for account:');
for (const c of remaining || []) {
  console.log('  ', { id: c.id, has_page_id: Boolean(c.page_id), has_page_token: Boolean(c.page_access_token) });
}
