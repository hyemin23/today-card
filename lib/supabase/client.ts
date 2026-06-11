'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client.
 * Returns `null` when env vars are absent so the app can run in
 * "local-only" mode (magazines kept in localStorage, no server writes).
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
