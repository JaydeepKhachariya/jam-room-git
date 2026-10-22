import { createHash, randomBytes } from "node:crypto";

import {
  isQueued,
  playbackPosition,
  roomChannelName,
  type QueuedSong,
  type RoomAction,
  type RoomPlayback,
  type RoomSnapshot,
} from "@/lib/room";
import { supabaseAdmin } from "@/lib/supabase-admin";

/*
 * Rooms live in Supabase Postgres, so every server instance (Vercel runs
 * many) sees the same room. After each change the new state is broadcast
 * on the room's Realtime channel; who's listening is tracked there too,
 * with Realtime Presence.
 */

// Broadcast messages are size-limited, and the whole queue is sent.
const MAX_QUEUE = 200;
/** Rooms untouched for this long are deleted when a new room is made. */
const IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Retries when another instance changed the room at the same moment. */
const MAX_ATTEMPTS = 5;

const COLUMNS = "id, name, owner_id, queue, playback, finished, banned, version";

interface RoomRow {
  id: string;
  name: string;
  owner_id: string;
  queue: QueuedSong[];
  playback: RoomPlayback;
  /** Playback ran off the end of the queue; the next song added starts. */
  finished: boolean;
  /** Members the host removed; they can't rejoin or act. */
  banned: string[];
  version: number;
}

/** The parts of a room that playback actions change. */
type RoomState = Pick<RoomRow, "queue" | "playback" | "finished">;

export type RoomResult =
  | { ok: true; room: RoomSnapshot }
  | {
      ok: false;
      status: 403 | 404 | 409;
      error: string;
      code?: "removed";
    };

const NOT_FOUND = { ok: false, status: 404, error: "Room not found." } as const;
const REMOVED = {
  ok: false,
  status: 403,
  error: "The host removed you from this room.",
  code: "removed",
} as const;

function newId() {
  return randomBytes(6).toString("base64url");
}

/** The public id for a client token. Tokens themselves are never shared. */
export function memberIdFor(token: string) {
  return createHash("sha256").update(token).digest("base64url").slice(0, 16);
}

/** The room as everyone sees it; each listener fills in `you`. */
function sharedSnapshot(row: RoomRow): Omit<RoomSnapshot, "you"> {
  return {
    id: row.id,
    name: row.name,
    queue: row.queue,
    playback: row.playback,
    ownerId: row.owner_id,
    version: row.version,
    serverTime: Date.now(),
  };
}

function toSnapshot(row: RoomRow, you: string): RoomSnapshot {
  return { ...sharedSnapshot(row), you };
}

async function fetchRoom(id: string) {
  const { data, error } = await supabaseAdmin()
    .from("rooms")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<RoomRow>();
  if (error) throw error;
  return data;
}

/**
 * Tells everyone in the room. Best effort: the change is already saved,
 * and listeners also re-fetch the room periodically.
 */
async function broadcast(roomId: string, event: string, payload: object) {
  const supabase = supabaseAdmin();
  const channel = supabase.channel(roomChannelName(roomId));
  try {
    await channel.httpSend(event, payload);
  } catch (error) {
    console.error(`Couldn't broadcast ${event} to room ${roomId}:`, error);
  } finally {
    void supabase.removeChannel(channel);
  }
}

export async function createRoom(name: string, ownerToken: string) {
  const supabase = supabaseAdmin();

  // Clean up long-idle rooms as new ones are made.
  await supabase
    .from("rooms")
    .delete()
    .lt("updated_at", new Date(Date.now() - IDLE_TTL_MS).toISOString());

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newId();
    const { error } = await supabase.from("rooms").insert({
      id,
      name,
      owner_id: memberIdFor(ownerToken),
      playback: {
        index: -1,
        playing: false,
        position: 0,
        updatedAt: Date.now(),
      } satisfies RoomPlayback,
    });
    if (!error) return id;
    // 23505: unique violation, i.e. the id is taken. Try another.
    if (error.code !== "23505") throw error;
  }

  throw new Error("Couldn't pick a room id.");
}

export async function getRoom(id: string, token: string): Promise<RoomResult> {
  const row = await fetchRoom(id);
  if (!row) return NOT_FOUND;

  const you = memberIdFor(token);
  if (row.banned.includes(you)) return REMOVED;
  return { ok: true, room: toSnapshot(row, you) };
}

export async function applyRoomAction(
  id: string,
  token: string,
  action: RoomAction
): Promise<RoomResult> {
  const you = memberIdFor(token);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const row = await fetchRoom(id);
    if (!row) return NOT_FOUND;
    if (row.banned.includes(you)) return REMOVED;

    let next: RoomRow;
    if (action.type === "removeMember") {
      if (you !== row.owner_id) {
        return {
          ok: false,
          status: 403,
          error: "Only the host can remove people.",
        };
      }
      if (
        action.memberId === row.owner_id ||
        row.banned.includes(action.memberId)
      ) {
        return { ok: true, room: toSnapshot(row, you) };
      }
      next = { ...row, banned: [...row.banned, action.memberId] };
    } else {
      const state: RoomState = {
        queue: [...row.queue],
        playback: row.playback,
        finished: row.finished,
      };
      if (!reduce(state, action)) {
        return { ok: true, room: toSnapshot(row, you) };
      }
      next = { ...row, ...state };
    }
    next.version = row.version + 1;

    // Only applies if nobody else changed the room since it was read.
    const { data, error } = await supabaseAdmin()
      .from("rooms")
      .update({
        queue: next.queue,
        playback: next.playback,
        finished: next.finished,
        banned: next.banned,
        version: next.version,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", row.version)
      .select("id");
    if (error) throw error;
    if (data.length === 0) continue;

    if (action.type === "removeMember") {
      await broadcast(id, "removed", { memberId: action.memberId });
    }
    await broadcast(id, "state", sharedSnapshot(next));
    return { ok: true, room: toSnapshot(next, you) };
  }

  return {
    ok: false,
    status: 409,
    error: "Lots happening in this room right now. Try again.",
  };
}

function setPlayback(
  state: RoomState,
  next: Pick<RoomPlayback, "index" | "playing" | "position">
) {
  state.playback = { ...next, updatedAt: Date.now() };
  state.finished = false;
}

/** Applies a playback action to `state`. Returns whether it changed. */
function reduce(
  state: RoomState,
  action: Exclude<RoomAction, { type: "removeMember" }>
): boolean {
  const { queue, playback } = state;
  const now = Date.now();
  const current = queue[playback.index];

  switch (action.type) {
    case "add": {
      if (queue.length >= MAX_QUEUE) return false;
      // Someone else may have just queued it; don't add it twice.
      if (isQueued(queue, playback, action.song.id) && !state.finished) {
        return false;
      }
      queue.push({ ...action.song, queueId: newId(), addedBy: action.addedBy });
      // Start right away if nothing is lined up to play.
      if (!current || state.finished) {
        setPlayback(state, {
          index: queue.length - 1,
          playing: true,
          position: 0,
        });
      }
      return true;
    }

    case "remove": {
      const index = queue.findIndex(
        (song) => song.queueId === action.queueId
      );
      if (index === -1) return false;
      queue.splice(index, 1);

      if (index < playback.index) {
        state.playback = { ...playback, index: playback.index - 1 };
      } else if (index === playback.index) {
        // The current song was removed: move on to the one after it.
        const hasNext = index < queue.length;
        setPlayback(state, {
          index: hasNext ? index : -1,
          playing: hasNext && playback.playing,
          position: 0,
        });
      }
      return true;
    }

    case "jump": {
      const index = queue.findIndex(
        (song) => song.queueId === action.queueId
      );
      if (index === -1) return false;
      setPlayback(state, { index, playing: true, position: 0 });
      return true;
    }

    case "play": {
      if (!current) {
        if (queue.length === 0) return false;
        setPlayback(state, { index: 0, playing: true, position: 0 });
        return true;
      }
      if (playback.playing) return false;
      setPlayback(state, {
        index: playback.index,
        playing: true,
        position: playback.position,
      });
      return true;
    }

    case "pause": {
      if (!playback.playing) return false;
      setPlayback(state, {
        index: playback.index,
        playing: false,
        position: playbackPosition(playback, now),
      });
      return true;
    }

    case "seek": {
      if (!current) return false;
      setPlayback(state, {
        index: playback.index,
        playing: playback.playing,
        position: action.position,
      });
      return true;
    }

    case "next": {
      if (current?.queueId !== action.from || state.finished) return false;
      if (playback.index < queue.length - 1) {
        setPlayback(state, {
          index: playback.index + 1,
          playing: true,
          position: 0,
        });
      } else {
        // End of the queue: stop on the last song.
        setPlayback(state, {
          index: playback.index,
          playing: false,
          position: 0,
        });
        state.finished = true;
      }
      return true;
    }

    case "previous": {
      if (current?.queueId !== action.from) return false;
      setPlayback(state, {
        index: Math.max(0, playback.index - 1),
        playing: true,
        position: 0,
      });
      return true;
    }
  }
}
