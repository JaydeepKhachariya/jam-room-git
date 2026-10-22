"use client";

import { createLocalStore } from "@/lib/local-store";

const MAX_ROOMS = 30;

/** A room this browser created or joined. */
export interface KnownRoom {
  id: string;
  name: string;
  /** When it was last opened here, in ms. */
  lastVisited: number;
}

function isKnownRoom(value: unknown): value is KnownRoom {
  if (!value || typeof value !== "object") return false;
  const room = value as Record<string, unknown>;
  return (
    typeof room.id === "string" &&
    typeof room.name === "string" &&
    typeof room.lastVisited === "number"
  );
}

/** Most recently opened first. */
const rooms = createLocalStore<KnownRoom[]>(
  "jam-rooms:rooms",
  (value) => (Array.isArray(value) ? value.filter(isKnownRoom) : []),
  []
);

export const useMyRooms = rooms.useValue;

export function rememberRoom(id: string, name: string) {
  rooms.update((known) =>
    [
      { id, name, lastVisited: Date.now() },
      ...known.filter((room) => room.id !== id),
    ].slice(0, MAX_ROOMS)
  );
}

export function forgetRooms(ids: string[]) {
  if (ids.length === 0) return;
  rooms.update((known) => known.filter((room) => !ids.includes(room.id)));
}
