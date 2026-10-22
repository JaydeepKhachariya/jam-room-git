"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getClientToken } from "@/lib/client-token";
import {
  CLIENT_HEADER,
  roomChannelName,
  type RoomAction,
  type RoomMember,
  type RoomSnapshot,
} from "@/lib/room";
import { supabaseBrowser } from "@/lib/supabase-browser";

/** Wait before double-checking a 404, in case it was a fluke. */
const CONFIRM_GONE_MS = 1000;
/** Clock samples taken in a burst on joining. */
const CLOCK_INITIAL_SAMPLES = 5;
const CLOCK_SAMPLES_KEPT = 10;
/**
 * Re-fetch the room this often: catches any missed broadcast, and
 * keeps the clock estimate fresh.
 */
const REFRESH_MS = 20_000;

/** What each tab shares with Realtime Presence. */
interface PresenceInfo {
  name: string;
  joinedAt: number;
}

/** One entry per person, however many tabs they have open. */
function membersFrom(state: Record<string, PresenceInfo[]>): RoomMember[] {
  return Object.entries(state)
    .filter(([, tabs]) => tabs.length > 0)
    .map(([id, tabs]) => ({
      id,
      name: tabs[tabs.length - 1].name,
      joinedAt: Math.min(...tabs.map((tab) => tab.joinedAt)),
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

class RoomGoneError extends Error {}
class RemovedFromRoomError extends Error {}

/** Fetches JSON, timing the round trip for clock sampling. */
async function request<T extends { serverTime: number }>(
  url: string,
  init: RequestInit = {},
  onClockSample?: (offset: number, roundTrip: number) => void
) {
  const sentAt = Date.now();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { ...init.headers, [CLIENT_HEADER]: getClientToken() },
  });
  const receivedAt = Date.now();
  const data: T & { error?: string; code?: string } = await response.json();

  if (response.status === 404) throw new RoomGoneError(data.error);
  if (data.code === "removed") throw new RemovedFromRoomError(data.error);
  if (!response.ok) throw new Error(data.error ?? "Request failed.");

  // Assume the server stamped its time halfway through the round trip.
  const roundTrip = receivedAt - sentAt;
  onClockSample?.(data.serverTime + roundTrip / 2 - receivedAt, roundTrip);
  return data;
}

export type RoomStatus = "loading" | "ready" | "not-found" | "removed" | "error";

/**
 * Live state of a shared room. Once `name` is set, joins the room's
 * Realtime channel: changes arrive as broadcasts, and who's listening
 * comes from presence.
 */
export function useRoom(roomId: string, name: string | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [connected, setConnected] = useState(false);
  const [actionError, setActionError] = useState("");

  const versionRef = useRef(-1);
  /** This listener's member id, from the first fetch of the room. */
  const youRef = useRef<string | null>(null);
  const clockSamplesRef = useRef<{ offset: number; roundTrip: number }[]>([]);
  const clockOffsetRef = useRef(0);

  /** Keeps recent samples and trusts the one with the shortest trip. */
  const sampleClock = useCallback((offset: number, roundTrip: number) => {
    const samples = [...clockSamplesRef.current, { offset, roundTrip }].slice(
      -CLOCK_SAMPLES_KEPT
    );
    clockSamplesRef.current = samples;
    clockOffsetRef.current = samples.reduce((best, sample) =>
      sample.roundTrip < best.roundTrip ? sample : best
    ).offset;
  }, []);

  /** The server's clock, estimated from this device's. */
  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  /**
   * Applies a snapshot unless a newer one has already arrived.
   * Broadcasts don't say who `you` are; that comes from fetches.
   */
  const accept = useCallback(
    (next: Omit<RoomSnapshot, "you"> & { you?: string }) => {
      if (next.you) youRef.current = next.you;
      if (next.version <= versionRef.current || !youRef.current) return;
      versionRef.current = next.version;
      setRoom({ ...next, you: youRef.current });
    },
    []
  );

  const refresh = useCallback(
    () =>
      request<RoomSnapshot>(`/api/rooms/${roomId}`, {}, sampleClock).then(
        accept
      ),
    [roomId, accept, sampleClock]
  );

  const fail = useCallback((error: unknown) => {
    if (error instanceof RemovedFromRoomError) setStatus("removed");
    else if (error instanceof RoomGoneError) setStatus("not-found");
    else return false;
    return true;
  }, []);

  /**
   * Re-fetches the room after a hint that it's gone, so one bad
   * response (e.g. the dev server reloading) doesn't end the session.
   */
  const confirmRoom = useCallback(
    (onStillThere: () => void) => {
      window.setTimeout(() => {
        refresh()
          .then(onStillThere)
          .catch((error: unknown) => {
            if (!fail(error)) onStillThere();
          });
      }, CONFIRM_GONE_MS);
    },
    [refresh, fail]
  );

  useEffect(() => {
    let cancelled = false;

    refresh()
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!fail(error)) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [refresh, fail]);

  // Measure the clock offset against a cheap endpoint, a burst on
  // joining; periodic refreshes keep sampling after that.
  useEffect(() => {
    if (status !== "ready") return;

    let cancelled = false;
    let timer: number | undefined;

    async function measure(remaining: number) {
      await request<{ serverTime: number }>("/api/time", {}, sampleClock).catch(
        () => {}
      );
      if (cancelled || remaining <= 1) return;
      timer = window.setTimeout(() => void measure(remaining - 1), 250);
    }

    void measure(CLOCK_INITIAL_SAMPLES);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status, sampleClock]);

  useEffect(() => {
    if (status !== "ready") return;

    const interval = window.setInterval(() => {
      refresh().catch((error: unknown) => {
        if (error instanceof RoomGoneError) confirmRoom(() => {});
        else fail(error);
      });
    }, REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [status, refresh, confirmRoom, fail]);

  useEffect(() => {
    const you = youRef.current;
    if (status !== "ready" || !name || !you) return;

    let supabase: ReturnType<typeof supabaseBrowser>;
    try {
      supabase = supabaseBrowser();
    } catch (error) {
      console.error(error);
      return;
    }

    const joinedAt = Date.now();
    const channel = supabase.channel(roomChannelName(roomId), {
      // Keyed by member id, so someone's tabs show up as one person.
      config: { presence: { key: you } },
    });

    channel
      .on("broadcast", { event: "state" }, ({ payload }) => {
        accept(payload as Omit<RoomSnapshot, "you">);
      })
      .on("broadcast", { event: "removed" }, ({ payload }) => {
        if ((payload as { memberId?: string }).memberId === you) {
          setStatus("removed");
        }
      })
      .on("presence", { event: "sync" }, () => {
        setMembers(membersFrom(channel.presenceState<PresenceInfo>()));
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setConnected(true);
          void channel.track({ name, joinedAt } satisfies PresenceInfo);
          // Catch up on anything missed while (re)connecting.
          refresh().catch(fail);
        } else {
          // CHANNEL_ERROR, TIMED_OUT or CLOSED: supabase-js rejoins
          // by itself, and reports SUBSCRIBED again when it does.
          setConnected(false);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      setConnected(false);
      setMembers([]);
    };
  }, [roomId, name, status, accept, refresh, fail]);

  const send = useCallback(
    async (action: RoomAction) => {
      try {
        const snapshot = await request<RoomSnapshot>(
          `/api/rooms/${roomId}/actions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          },
          sampleClock
        );
        setActionError("");
        accept(snapshot);
      } catch (error: unknown) {
        if (error instanceof RoomGoneError) {
          confirmRoom(() => setActionError("That didn't go through. Try again."));
        } else if (!fail(error)) {
          setActionError(
            error instanceof Error ? error.message : "Something went wrong."
          );
        }
      }
    },
    [roomId, accept, fail, confirmRoom, sampleClock]
  );

  return { room, members, status, connected, actionError, send, serverNow };
}
