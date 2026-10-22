import { isSong, type Song } from "@/lib/song";

export interface QueueEntry extends Song {
  /** Unique per queue entry, so the same song can be queued twice. */
  queueId: string;
}

/** An entry in this browser's own queue (outside rooms). */
export interface LocalQueueEntry extends QueueEntry {
  /** Added with "Add to queue", rather than following the picked song. */
  manual: boolean;
}

export function toLocalEntry(song: Song, manual = false): LocalQueueEntry {
  return {
    id: song.id,
    title: song.title,
    artists: song.artists,
    thumbnail: song.thumbnail,
    ...(song.duration ? { duration: song.duration } : {}),
    queueId: crypto.randomUUID(),
    manual,
  };
}

/** Reads a saved entry; ones saved before queue ids existed get one. */
export function parseLocalEntry(value: unknown): LocalQueueEntry | null {
  if (!isSong(value)) return null;
  const entry = value as Song & Partial<LocalQueueEntry>;
  return {
    ...toLocalEntry(entry, entry.manual === true),
    ...(typeof entry.queueId === "string" && entry.queueId
      ? { queueId: entry.queueId }
      : {}),
  };
}

/**
 * Moves the entry `queueId` to just after `afterQueueId`, or to the top
 * when that's null. Anchoring to a neighbour rather than an index keeps
 * the move right even if the queue changed since the mover saw it.
 * Returns the reordered queue, or null if nothing would change.
 */
export function moveInQueue<T extends { queueId: string }>(
  queue: readonly T[],
  queueId: string,
  afterQueueId: string | null
): T[] | null {
  if (queueId === afterQueueId) return null;

  const from = queue.findIndex((entry) => entry.queueId === queueId);
  if (from === -1) return null;

  const rest = queue.filter((_, index) => index !== from);
  let to = 0;
  if (afterQueueId !== null) {
    const after = rest.findIndex((entry) => entry.queueId === afterQueueId);
    if (after === -1) return null;
    to = after + 1;
  }
  if (to === from) return null;

  rest.splice(to, 0, queue[from]);
  return rest;
}
