"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getClientToken } from "@/lib/client-token";
import { forgetRooms, useMyRooms, type KnownRoom } from "@/lib/my-rooms";
import { CLIENT_HEADER, roomChannelName, type RoomMember } from "@/lib/room";
import { membersFrom, type PresenceInfo } from "@/lib/room-presence";
import type { RoomSummary } from "@/lib/rooms";
import { supabaseWatcher } from "@/lib/supabase-browser";

/** How often what's playing in each room is re-checked. */
const REFRESH_MS = 30_000;

export interface DirectoryRoom extends KnownRoom {
  /** Null until loaded. */
  summary: RoomSummary | null;
  /** Who's listening; null until presence has synced. */
  members: RoomMember[] | null;
}

interface RoomsDirectory {
  rooms: DirectoryRoom[];
  /** Rooms with someone listening, most recently opened first. */
  live: DirectoryRoom[];
}

const DirectoryContext = createContext<RoomsDirectory>({ rooms: [], live: [] });

export const useRoomsDirectory = () => useContext(DirectoryContext);

/**
 * "Your rooms": the rooms this browser has opened, with what's playing
 * and who's listening. Paused (`enabled` false) while you're in a room.
 */
export function RoomsDirectoryProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const known = useMyRooms();
  const idsKey = known.map((room) => room.id).join(",");

  const [summaries, setSummaries] = useState<Record<string, RoomSummary>>({});
  const [members, setMembers] = useState<Record<string, RoomMember[]>>({});

  useEffect(() => {
    if (!enabled || !idsKey) return;
    const ids = idsKey.split(",");
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/rooms?ids=${idsKey}`, {
          cache: "no-store",
          headers: { [CLIENT_HEADER]: getClientToken() },
        });
        if (!response.ok) return;
        const data: { rooms: RoomSummary[] } = await response.json();
        if (cancelled) return;

        setSummaries(
          Object.fromEntries(data.rooms.map((room) => [room.id, room]))
        );
        // Gone (closed after a week idle) or you were removed.
        const found = new Set(data.rooms.map((room) => room.id));
        forgetRooms(ids.filter((id) => !found.has(id)));
      } catch {
        // Offline or rooms unavailable: keep what's shown.
      }
    }

    void load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, idsKey]);

  // Watch each room's presence without joining it (nothing is tracked,
  // so you don't show up as listening).
  useEffect(() => {
    if (!enabled || !idsKey) return;

    let supabase: ReturnType<typeof supabaseWatcher>;
    try {
      supabase = supabaseWatcher();
    } catch (error) {
      console.error(error);
      return;
    }

    const channels = idsKey.split(",").map((id) => {
      const channel = supabase.channel(roomChannelName(id));
      channel
        .on("presence", { event: "sync" }, () => {
          const present = membersFrom(channel.presenceState<PresenceInfo>());
          setMembers((prev) => ({ ...prev, [id]: present }));
        })
        .subscribe();
      return channel;
    });

    return () => {
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [enabled, idsKey]);

  const value = useMemo(() => {
    const rooms = known.map((room) => ({
      ...room,
      name: summaries[room.id]?.name ?? room.name,
      summary: summaries[room.id] ?? null,
      members: members[room.id] ?? null,
    }));
    return {
      rooms,
      live: rooms.filter((room) => (room.members?.length ?? 0) > 0),
    };
  }, [known, summaries, members]);

  return (
    <DirectoryContext.Provider value={value}>
      {children}
    </DirectoryContext.Provider>
  );
}
