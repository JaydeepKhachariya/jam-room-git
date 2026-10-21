import { randomBytes } from "node:crypto";

import {
  playbackPosition,
  type QueuedSong,
  type RoomAction,
  type RoomPlayback,
  type RoomSnapshot,
} from "@/lib/room";

/*
 * Rooms live in server memory: they're shared by everyone connected to
 * this server process and are lost when it restarts. This needs a single
 * long-running server (`next dev` / `next start`), not serverless.
 */

const MAX_ROOMS = 1000;
const MAX_QUEUE = 500;
/** Rooms nobody has been in for this long are deleted. */
const IDLE_TTL_MS = 24 * 60 * 60 * 1000;
/** Pause once everyone has left, unless someone is back (e.g. a reload). */
const EMPTY_PAUSE_MS = 30 * 1000;

type Listener = (snapshot: RoomSnapshot) => void;

interface Room {
  id: string;
  name: string;
  queue: QueuedSong[];
  playback: RoomPlayback;
  /** Playback ran off the end of the queue; the next song added starts. */
  finished: boolean;
  version: number;
  lastActiveAt: number;
  subscribers: Map<string, { name: string; listener: Listener }>;
  emptyTimer?: ReturnType<typeof setTimeout>;
}

// Kept on globalThis so dev reloads and separately bundled route
// handlers all share one store.
const globalStore = globalThis as typeof globalThis & {
  __jamRooms?: Map<string, Room>;
};
const rooms = (globalStore.__jamRooms ??= new Map<string, Room>());

function newId() {
  return randomBytes(6).toString("base64url");
}

function snapshot(room: Room): RoomSnapshot {
  return {
    id: room.id,
    name: room.name,
    queue: room.queue,
    playback: room.playback,
    members: [...room.subscribers].map(([id, { name }]) => ({ id, name })),
    version: room.version,
    serverTime: Date.now(),
  };
}

function broadcast(room: Room) {
  room.version += 1;
  room.lastActiveAt = Date.now();
  const state = snapshot(room);
  for (const { listener } of room.subscribers.values()) listener(state);
}

function setPlayback(
  room: Room,
  next: Pick<RoomPlayback, "index" | "playing" | "position">
) {
  room.playback = { ...next, updatedAt: Date.now() };
  room.finished = false;
}

function pruneIdleRooms() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.subscribers.size === 0 && now - room.lastActiveAt > IDLE_TTL_MS) {
      clearTimeout(room.emptyTimer);
      rooms.delete(room.id);
    }
  }
}

export function createRoom(name: string) {
  pruneIdleRooms();
  if (rooms.size >= MAX_ROOMS) return null;

  let id = newId();
  while (rooms.has(id)) id = newId();

  rooms.set(id, {
    id,
    name,
    queue: [],
    playback: { index: -1, playing: false, position: 0, updatedAt: Date.now() },
    finished: false,
    version: 0,
    lastActiveAt: Date.now(),
    subscribers: new Map(),
  });

  return id;
}

export function getRoomSnapshot(id: string) {
  const room = rooms.get(id);
  return room ? snapshot(room) : null;
}

/** Applies an action. Returns null if the room doesn't exist. */
export function applyRoomAction(id: string, action: RoomAction) {
  const room = rooms.get(id);
  if (!room) return null;

  if (reduce(room, action)) broadcast(room);
  return snapshot(room);
}

/** Returns whether the room changed. */
function reduce(room: Room, action: RoomAction): boolean {
  const { queue, playback } = room;
  const now = Date.now();
  const current = queue[playback.index];

  switch (action.type) {
    case "add": {
      if (queue.length >= MAX_QUEUE) return false;
      queue.push({ ...action.song, queueId: newId(), addedBy: action.addedBy });
      // Start right away if nothing is lined up to play.
      if (!current || room.finished) {
        setPlayback(room, {
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
        room.playback = { ...playback, index: playback.index - 1 };
      } else if (index === playback.index) {
        // The current song was removed: move on to the one after it.
        const hasNext = index < queue.length;
        setPlayback(room, {
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
      setPlayback(room, { index, playing: true, position: 0 });
      return true;
    }

    case "play": {
      if (!current) {
        if (queue.length === 0) return false;
        setPlayback(room, { index: 0, playing: true, position: 0 });
        return true;
      }
      if (playback.playing) return false;
      setPlayback(room, {
        index: playback.index,
        playing: true,
        position: playback.position,
      });
      return true;
    }

    case "pause": {
      if (!playback.playing) return false;
      setPlayback(room, {
        index: playback.index,
        playing: false,
        position: playbackPosition(playback, now),
      });
      return true;
    }

    case "seek": {
      if (!current) return false;
      setPlayback(room, {
        index: playback.index,
        playing: playback.playing,
        position: action.position,
      });
      return true;
    }

    case "next": {
      if (current?.queueId !== action.from || room.finished) return false;
      if (playback.index < queue.length - 1) {
        setPlayback(room, {
          index: playback.index + 1,
          playing: true,
          position: 0,
        });
      } else {
        // End of the queue: stop on the last song.
        setPlayback(room, {
          index: playback.index,
          playing: false,
          position: 0,
        });
        room.finished = true;
      }
      return true;
    }

    case "previous": {
      if (current?.queueId !== action.from) return false;
      setPlayback(room, {
        index: Math.max(0, playback.index - 1),
        playing: true,
        position: 0,
      });
      return true;
    }
  }
}

/**
 * Joins a room and calls `listener` with the current state and every
 * change after it. Returns an unsubscribe function, or null if the room
 * doesn't exist.
 */
export function subscribeToRoom(id: string, name: string, listener: Listener) {
  const room = rooms.get(id);
  if (!room) return null;

  const memberId = newId();
  clearTimeout(room.emptyTimer);
  room.subscribers.set(memberId, { name, listener });
  broadcast(room);

  return () => {
    if (!room.subscribers.delete(memberId)) return;
    broadcast(room);

    if (room.subscribers.size === 0) {
      room.emptyTimer = setTimeout(() => {
        if (room.subscribers.size === 0 && reduce(room, { type: "pause" })) {
          broadcast(room);
        }
      }, EMPTY_PAUSE_MS);
    }
  };
}
