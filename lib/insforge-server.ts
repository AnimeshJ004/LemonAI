/**
 * InsForge Compatibility Layer — Powered by Supabase
 *
 * This module re-exports the Supabase client implementation from `@/lib/supabase-server`
 * to maintain complete backward compatibility across all existing endpoints and server functions.
 */

export {
  getSupabaseServerClient as getInsforgeServerClient,
  getSupabaseAdminClient as getInsforgeAdminClient,
  getSupabaseUploadClient as getInsforgeUploadClient,
  getSupabaseServerClient,
  getSupabaseAdminClient,
  getSupabaseUploadClient,
  type EnhancedSupabaseClient as InsForgeClient,
  type EnhancedSupabaseClient,
} from '@/lib/supabase-server';
