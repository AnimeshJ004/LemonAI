import { auth } from '@clerk/nextjs/server';
import { createClient, type InsForgeClient } from '@insforge/sdk';
import { PostgrestClient } from '@supabase/postgrest-js';

// Environment variables (support both InsForge and Supabase)
const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PROJECT_API_KEY = process.env.INSFORGE_PROJECT_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEMPLATE = process.env.CLERK_INSFORGE_TEMPLATE || process.env.CLERK_SUPABASE_TEMPLATE;

const SERVER_TOKEN_TEMPLATE = TEMPLATE || 'supabase';

function isSupabaseUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('supabase.co') || url.includes('supabase.in') || url.includes('/rest/v1');
}

function createSupabaseCompatClient(baseUrl: string, apiKey: string, defaultToken?: string | null): InsForgeClient {
  const cleanBase = baseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  let currentToken = defaultToken;

  function getHeaders() {
    const headers: Record<string, string> = {
      apikey: apiKey,
      Authorization: `Bearer ${currentToken || apiKey}`,
    };
    return headers;
  }

  const client = {
    database: {
      from: (table: string) => {
        const pg = new PostgrestClient(`${cleanBase}/rest/v1`, {
          headers: getHeaders(),
        });
        return pg.from(table);
      },
      schema: (schemaName: string) => {
        const pg = new PostgrestClient(`${cleanBase}/rest/v1`, {
          headers: getHeaders(),
          schema: schemaName,
        });
        return pg;
      },
      rpc: (fn: string, args?: any, options?: any) => {
        const pg = new PostgrestClient(`${cleanBase}/rest/v1`, {
          headers: getHeaders(),
        });
        return pg.rpc(fn, args, options);
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (storagePath: string, file: any) => {
          try {
            const uploadUrl = `${cleanBase}/storage/v1/object/${bucket}/${storagePath}`;
            const res = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${currentToken || apiKey}`,
                'x-upsert': 'true',
                ...(file?.type ? { 'content-type': file.type } : {}),
              },
              body: file,
            });
            if (!res.ok) {
              const errText = await res.text();
              return { data: null, error: new Error(errText) };
            }
            const publicUrl = `${cleanBase}/storage/v1/object/public/${bucket}/${storagePath}`;
            return { data: { url: publicUrl, key: storagePath }, error: null };
          } catch (err: any) {
            return { data: null, error: err };
          }
        },
        getPublicUrl: (storagePath: string) => {
          const publicUrl = `${cleanBase}/storage/v1/object/public/${bucket}/${storagePath}`;
          return { data: { publicUrl } };
        },
      }),
    },
    getHttpClient: () => ({
      setAuthToken: (token: string | null) => {
        currentToken = token;
      },
      rawFetch: async (url: string, init?: RequestInit) => {
        return fetch(url, init);
      },
    }),
  } as unknown as InsForgeClient;

  return client;
}

export async function getInsforgeServerClient(): Promise<{ insforge: InsForgeClient; userId: string | null }> {
  if (!BASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_INSFORGE_BASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  // Get current user from Clerk
  const { userId } = await auth();

  // Use PROJECT_API_KEY if available for robust server-side database access, otherwise ANON_KEY
  const apiKey = PROJECT_API_KEY || ANON_KEY;
  if (!apiKey) {
    throw new Error('Missing INSFORGE_PROJECT_API_KEY, SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_INSFORGE_ANON_KEY');
  }

  if (isSupabaseUrl(BASE_URL)) {
    let token: string | null = null;
    if (userId && !PROJECT_API_KEY) {
      try {
        const session = await auth();
        token = (await session?.getToken({ template: SERVER_TOKEN_TEMPLATE })) || null;
      } catch (err) {
        console.warn('Failed to get Clerk JWT token, falling back to API Key', err);
      }
    }
    const insforge = createSupabaseCompatClient(BASE_URL, apiKey, token);
    return { insforge, userId };
  }

  const insforge = createClient({
    baseUrl: BASE_URL,
    anonKey: apiKey,
    isServerMode: true,
  });

  if (userId && !PROJECT_API_KEY) {
    try {
      const session = await auth();
      const token = await session?.getToken({ template: SERVER_TOKEN_TEMPLATE });
      if (token) {
        insforge.getHttpClient().setAuthToken(token);
      }
    } catch (err) {
      console.warn('Failed to get Clerk JWT token, falling back to API Key', err);
    }
  }

  return { insforge, userId };
}

export function getInsforgeAdminClient(): InsForgeClient {
  // Validate environment variables
  if (!BASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_INSFORGE_BASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  const apiKey = PROJECT_API_KEY || ANON_KEY;
  if (!apiKey) {
    throw new Error('Missing INSFORGE_PROJECT_API_KEY, SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_INSFORGE_ANON_KEY');
  }

  if (isSupabaseUrl(BASE_URL)) {
    return createSupabaseCompatClient(BASE_URL, apiKey);
  }

  return createClient({
    baseUrl: BASE_URL,
    anonKey: apiKey,
    isServerMode: true,
  });
}

export const getInsforgeUploadClient = getInsforgeAdminClient;
