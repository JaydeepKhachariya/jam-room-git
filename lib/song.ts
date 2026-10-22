export interface Song {
  id: string;
  title: string;
  artists: string[];
  thumbnail: string | null;
  /** Length in seconds, when YouTube Music reports it. */
  duration?: number;
}

export function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Record<string, unknown>;
  return (
    typeof song.id === "string" &&
    song.id.length > 0 &&
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
