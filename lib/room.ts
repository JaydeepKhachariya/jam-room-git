import { isDuration, isSong, type Song } from "@/lib/song";

export const ROOM_NAME_MAX = 60;
export const MEMBER_NAME_MAX = 40;

/**
 * Each browser keeps a private random token. The server only ever shares
 * a hash of it (the member id), so the token can prove who's the host.
 * Sent as this header, or the `client` query param where headers can't be
 * set (EventSource).
 */
export const CLIENT_HEADER = "X-Jam-Client";

/** The Realtime channel a room's updates and presence go through. */
export function roomChannelName(roomId: string) {
  return `room:${roomId}`;
}

export function isClientToken(value: unknown): value is string {
  return typeof value === "string" && /^[\w-]{16,128}$/.test(value);
}

export interface QueuedSong extends Song {
  /** Unique per queue entry, so the same song can be queued twice. */
  queueId: string;
  addedBy: string;
}

/**
 * Playback is stored as a reference point: the room was at `position`
 * seconds at server time `updatedAt`, and has kept going since if
 * `playing`. Every listener derives the same position from it.
 */
export interface RoomPlayback {
  /** Index into the queue, or -1 when nothing is selected. */
  index: number;
  playing: boolean;
  position: number;
  updatedAt: number;
}

/** A person in the room; several tabs of one browser count once. */
export interface RoomMember {
  id: string;
  name: string;
  /** When they joined, for listing people in join order. */
  joinedAt: number;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  queue: QueuedSong[];
  playback: RoomPlayback;
  /** Member id of the room's creator, who can remove people. */
  ownerId: string;
  /** Everyone can change the queue; when false, only the host can. */
  open: boolean;
  /** Member id of whoever this snapshot was sent to. */
  you: string;
  /** Increments on every change, so stale updates can be ignored. */
  version: number;
  serverTime: number;
}

/**
 * `next` and `previous` carry the queue entry the sender saw as current.
 * When several listeners report the same song ending, only the first
 * one advances the room.
 */
export type RoomAction =
  | { type: "add"; song: Song; addedBy: string }
  | { type: "remove"; queueId: string }
  | { type: "jump"; queueId: string }
  /** Puts the entry just after `afterQueueId`, or first when null. */
  | { type: "move"; queueId: string; afterQueueId: string | null }
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; position: number }
  | { type: "next"; from: string }
  | { type: "previous"; from: string }
  | { type: "removeMember"; memberId: string };

/**
 * Whether a song is waiting in the queue: it's the current song or comes
 * after it. Songs already played can be added again.
 */
export function isQueued(
  queue: Song[],
  playback: Pick<RoomPlayback, "index">,
  songId: string
) {
  for (let i = Math.max(0, playback.index); i < queue.length; i++) {
    if (queue[i].id === songId) return true;
  }
  return false;
}

/** Where playback is at `now` (server time), in seconds. */
export function playbackPosition(playback: RoomPlayback, now: number) {
  if (!playback.playing) return playback.position;
  return playback.position + Math.max(0, now - playback.updatedAt) / 1000;
}

export function cleanName(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, max);
  return name || null;
}

function cleanSong(value: unknown): Song | null {
  if (!isSong(value) || !/^[\w-]{1,64}$/.test(value.id)) return null;

  const thumbnail =
    value.thumbnail && /^https:\/\//.test(value.thumbnail)
      ? value.thumbnail.slice(0, 1000)
      : null;

  return {
    id: value.id,
    title: value.title.slice(0, 300),
    artists: value.artists.slice(0, 10).map((artist) => artist.slice(0, 200)),
    thumbnail,
    ...(isDuration(value.duration) ? { duration: value.duration } : {}),
  };
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

/** Validates an action from a request body. */
export function parseRoomAction(value: unknown): RoomAction | null {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;

  switch (action.type) {
    case "add": {
      const song = cleanSong(action.song);
      const addedBy = cleanName(action.addedBy, MEMBER_NAME_MAX);
      return song && addedBy ? { type: "add", song, addedBy } : null;
    }
    case "remove":
    case "jump":
      return isId(action.queueId)
        ? { type: action.type, queueId: action.queueId }
        : null;
    case "move":
      return isId(action.queueId) &&
        (action.afterQueueId === null || isId(action.afterQueueId))
        ? {
            type: "move",
            queueId: action.queueId,
            afterQueueId: action.afterQueueId,
          }
        : null;
    case "play":
    case "pause":
      return { type: action.type };
    case "seek":
      return typeof action.position === "number" &&
        Number.isFinite(action.position)
        ? { type: "seek", position: Math.max(0, action.position) }
        : null;
    case "next":
    case "previous":
      return isId(action.from) ? { type: action.type, from: action.from } : null;
    case "removeMember":
      return isId(action.memberId)
        ? { type: "removeMember", memberId: action.memberId }
        : null;
    default:
      return null;
  }
}
