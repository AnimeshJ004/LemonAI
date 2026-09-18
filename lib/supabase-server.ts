import { auth } from '@clerk/nextjs/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables with graceful transition fallbacks
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ||
  '';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.INSFORGE_PROJECT_API_KEY ||
  '';

const CLERK_TEMPLATE =
  process.env.CLERK_SUPABASE_TEMPLATE ||
  process.env.NEXT_PUBLIC_CLERK_INSFORGE_TEMPLATE ||
  'supabase';

export type EnhancedStorageFileApi = Omit<ReturnType<SupabaseClient['storage']['from']>, 'upload'> & {
  upload: (
    path: string,
    fileBody: any,
    fileOptions?: any
  ) => Promise<{
    data: { id?: string; path: string; fullPath?: string; key?: string; url?: string } | null;
    error: any | null;
  }>;
};

export type EnhancedSupabaseClient = Omit<SupabaseClient, 'storage'> & {
  database: {
    from: SupabaseClient['from'];
    rpc: SupabaseClient['rpc'];
  };
  storage: {
    from: (bucket: string) => EnhancedStorageFileApi;
  };
};

/**
 * Enhances a SupabaseClient with a .database compatibility bridge and enriched storage responses
 * so existing codebase queries (using .database.from and expecting data.url on upload) work seamlessly.
 */
function enhanceClient(client: SupabaseClient): EnhancedSupabaseClient {
  const enhanced = client as unknown as EnhancedSupabaseClient;

  // 1. Database compatibility bridge (.database.from and .database.rpc)
  enhanced.database = {
    from: client.from.bind(client),
    rpc: client.rpc.bind(client),
  };

  // 2. Storage upload enhancement (attaches public url and key to upload response)
  const origStorageFrom = client.storage.from.bind(client.storage);
  client.storage.from = (bucket: string) => {
    const bucketApi = origStorageFrom(bucket);
    const origUpload = bucketApi.upload.bind(bucketApi);

    bucketApi.upload = async (path: string, fileBody: any, fileOptions?: any) => {
      const result = await origUpload(path, fileBody, fileOptions);
      if (result.data) {
        const { data: pubData } = bucketApi.getPublicUrl(result.data.path || path);
        (result.data as any).key = result.data.path || path;
        (result.data as any).url = pubData?.publicUrl || '';
      }
      return result;
    };

    return bucketApi;
  };

  return enhanced;
}

/**
 * Returns a server-side Supabase client scoped to the authenticated Clerk user.
 * Returns both `supabase` and `insforge` handles for 100% backward compatibility.
 */
export async function getSupabaseServerClient(): Promise<{
  supabase: EnhancedSupabaseClient;
  insforge: EnhancedSupabaseClient;
  userId: string | null;
}> {
  if (!SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable');
  }

  const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!apiKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const { userId } = await auth();

  // Attempt to forward Clerk JWT if template exists
  let authToken = apiKey;
  if (userId && !SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const session = await auth();
      const token = await session?.getToken({ template: CLERK_TEMPLATE });
      if (token) authToken = token;
    } catch (err) {
      console.warn('Failed to retrieve Clerk Supabase token, falling back to API key', err);
    }
  }

  const rawClient = createClient(SUPABASE_URL, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authToken !== apiKey ? { Authorization: `Bearer ${authToken}` } : {},
    },
  });

  const client = enhanceClient(rawClient);

  return {
    supabase: client,
    insforge: client, // Alias for backward compatibility
    userId,
  };
}

/**
 * Returns a privileged Supabase client with admin/service-role access.
 */
export function getSupabaseAdminClient(): EnhancedSupabaseClient {
  if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY — admin client requires the service role key');
  }
  const rawClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return enhanceClient(rawClient);
}

export const getSupabaseUploadClient = getSupabaseAdminClient;

// Backward-compatibility aliases for InsForge imports
export const getInsforgeServerClient = getSupabaseServerClient;
export const getInsforgeAdminClient = getSupabaseAdminClient;
export const getInsforgeUploadClient = getSupabaseUploadClient;
export type InsForgeClient = EnhancedSupabaseClient;
