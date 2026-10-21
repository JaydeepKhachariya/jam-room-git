"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RoomAction, RoomSnapshot } from "@/lib/room";

const RECONNECT_MS = 3000;

class RoomNotFoundError extends Error {}

/**
 * Fetches a room snapshot and samples the server clock from it.
 * The sample with the shortest round trip is the most accurate.
 */
async function request(
  url: string,
  init: RequestInit | undefined,
  onClockSample: (offset: number, roundTrip: number) => void
) {
  const sentAt = Date.now();
  const response = await fetch(url, init);
  const receivedAt = Date.now();
  const data: RoomSnapshot & { error?: string } = await response.json();

  if (response.status === 404) throw new RoomNotFoundError(data.error);
  if (!response.ok) throw new Error(data.error ?? "Request failed.");

  const roundTrip = receivedAt - sentAt;
  onClockSample(data.serverTime + roundTrip / 2 - receivedAt, roundTrip);
  return data;
}

export type RoomStatus = "loading" | "ready" | "not-found" | "error";

/**
 * Live state of a shared room. Once `name` is set, joins the room as a
 * listener and receives every change over Server-Sent Events.
 */
export function useRoom(roomId: string, name: string | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [connected, setConnected] = useState(false);
  const [actionError, setActionError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const versionRef = useRef(-1);
  const clockRef = useRef({ offset: 0, roundTrip: Infinity });

  const sampleClock = useCallback((offset: number, roundTrip: number) => {
    if (roundTrip <= clockRef.current.roundTrip) {
      clockRef.current = { offset, roundTrip };
    }
  }, []);

  /** Applies a snapshot unless a newer one has already arrived. */
  const accept = useCallback((next: RoomSnapshot) => {
    if (next.version <= versionRef.current) return;
    versionRef.current = next.version;
    setRoom(next);
  }, []);

  /** The server's clock, estimated from this device's. */
  const serverNow = useCallback(() => Date.now() + clockRef.current.offset, []);

  useEffect(() => {
    let cancelled = false;

    request(`/api/rooms/${roomId}`, undefined, sampleClock)
      .then((snapshot) => {
        if (cancelled) return;
        accept(snapshot);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof RoomNotFoundError ? "not-found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, accept, sampleClock]);

  useEffect(() => {
    if (status !== "ready" || !name) return;

    const source = new EventSource(
      `/api/rooms/${roomId}/events?name=${encodeURIComponent(name)}`
    );
    let retryTimer: number | undefined;

    source.onopen = () => setConnected(true);
    source.onmessage = (event: MessageEvent<string>) => {
      accept(JSON.parse(event.data) as RoomSnapshot);
    };
    source.onerror = () => {
      setConnected(false);
      // EventSource retries dropped connections itself, but gives up
      // on error responses. Check whether the room is gone, else retry.
      if (source.readyState !== EventSource.CLOSED) return;

      retryTimer = window.setTimeout(() => {
        request(`/api/rooms/${roomId}`, undefined, sampleClock)
          .then((snapshot) => {
            accept(snapshot);
            setAttempt((n) => n + 1);
          })
          .catch((error: unknown) => {
            if (error instanceof RoomNotFoundError) setStatus("not-found");
            else setAttempt((n) => n + 1);
          });
      }, RECONNECT_MS);
    };

    return () => {
      window.clearTimeout(retryTimer);
      source.close();
      setConnected(false);
    };
  }, [roomId, name, status, attempt, accept, sampleClock]);

  const send = useCallback(
    async (action: RoomAction) => {
      try {
        const snapshot = await request(
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
        if (error instanceof RoomNotFoundError) {
          setStatus("not-found");
          return;
        }
        setActionError(
          error instanceof Error ? error.message : "Something went wrong."
        );
      }
    },
    [roomId, accept, sampleClock]
  );

  return { room, status, connected, actionError, send, serverNow };
}
