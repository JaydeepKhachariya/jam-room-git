import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Server-only client with the secret key: bypasses row level security,
 * so it must never reach the browser. Used by the room API routes.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }

  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
