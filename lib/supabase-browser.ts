import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const clients: Partial<Record<"room" | "watcher", SupabaseClient>> = {};

function create(storageKey: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, storageKey },
  });
}

/**
 * Browser client with the publishable key. It can't read the rooms
 * table; it's only used for Realtime: room updates and who's listening.
 */
export function supabaseBrowser() {
  return (clients.room ??= create("jam-rooms-room"));
}

/**
 * A second connection for watching who's in "Your rooms". Realtime hands
 * back the existing channel when a topic is joined twice on one client,
 * so leaving a watched room there would also cut off the room you're in.
 */
export function supabaseWatcher() {
  return (clients.watcher ??= create("jam-rooms-watcher"));
}
