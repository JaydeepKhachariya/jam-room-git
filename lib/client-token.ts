import { isClientToken } from "@/lib/room";

const STORAGE_KEY = "jam-rooms:client";

// Used when storage is unavailable (private mode), for this page load.
let memoryToken: string | null = null;

function randomToken() {
  // getRandomValues, unlike randomUUID, also works over plain http
  // (e.g. a dev server opened by its LAN address).
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * This browser's private id. Rooms remember who created them by it, so
 * it stays in local storage and is only ever sent to this app's server.
 */
export function getClientToken() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isClientToken(stored)) return stored;

    const token = memoryToken ?? randomToken();
    window.localStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    memoryToken ??= randomToken();
    return memoryToken;
  }
}
