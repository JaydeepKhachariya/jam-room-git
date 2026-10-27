export interface Song {
  id: string;
  title: string;
  artists: string[];
  thumbnail: string | null;
  /** Length in seconds, when YouTube Music reports it. */
  duration?: number;
}

/** YouTube video IDs are exactly 11 URL-safe characters. */
export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[\w-]{11}$/.test(value);
}

export function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Record<string, unknown>;
  return (
    isVideoId(song.id) &&
    typeof song.title === "string" &&
    Array.isArray(song.artists) &&
    song.artists.every((artist) => typeof artist === "string") &&
    (song.thumbnail === null || typeof song.thumbnail === "string") &&
    (song.duration === undefined || isDuration(song.duration))
  );
}

export function isDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
