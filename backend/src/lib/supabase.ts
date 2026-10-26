import { createClient } from "@supabase/supabase-js";

// Server-side only. Every query in storage.service.ts filters by the authenticated user's id.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabase);
}
