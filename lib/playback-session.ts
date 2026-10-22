import { parseLocalEntry, type LocalQueueEntry } from "@/lib/queue";

const STORAGE_KEY = "jam-rooms:playback";
const VERSION = 1;

export type RepeatMode = "off" | "all" | "one";

export interface PlaybackSession {
  queue: LocalQueueEntry[];
  index: number;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  wasPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readPlaybackSession(): PlaybackSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.version !== VERSION || !Array.isArray(data.queue)) return null;

    const queue = data.queue
      .map(parseLocalEntry)
      .filter((entry) => entry !== null);
    const index = finiteNumber(data.index, -1);
    if (!queue[index]) return null;

    return {
      queue,
      index,
      position: Math.max(0, finiteNumber(data.position, 0)),
      duration: Math.max(0, finiteNumber(data.duration, 0)),
      volume: Math.min(100, Math.max(0, finiteNumber(data.volume, 80))),
      muted: data.muted === true,
      wasPlaying: data.wasPlaying === true,
      shuffle: data.shuffle === true,
      repeat:
        data.repeat === "all" || data.repeat === "one" ? data.repeat : "off",
    };
  } catch {
    return null;
  }
}

export function writePlaybackSession(session: PlaybackSession) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: VERSION, ...session })
    );
  } catch {
    // Storage full or unavailable (private mode) — resuming is best-effort.
  }
}
