import { isSong, type Song } from "@/lib/song";

export const ROOM_NAME_MAX = 60;
export const MEMBER_NAME_MAX = 40;

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

export interface RoomMember {
  id: string;
  name: string;
}

export interface RoomSnapshot {
  id: string;
  name: string;
  queue: QueuedSong[];
  playback: RoomPlayback;
  members: RoomMember[];
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
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; position: number }
  | { type: "next"; from: string }
  | { type: "previous"; from: string };

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
    default:
      return null;
  }
}
