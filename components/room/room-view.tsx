"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, DoorClosed, UserX } from "lucide-react";

import { PlayerBar } from "@/components/player-bar";
import { JoinRoomForm } from "@/components/room/join-room-form";
import { RoomMembers } from "@/components/room/room-members";
import { RoomQueue } from "@/components/room/room-queue";
import { ShareRoomButton } from "@/components/room/share-room-button";
import { SongBrowser } from "@/components/song-browser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayName } from "@/hooks/use-display-name";
import { useResumeOnGesture } from "@/hooks/use-resume-on-gesture";
import { useRoom } from "@/hooks/use-room";
import { useYouTubePlayer } from "@/hooks/use-youtube-player";
import { playbackPosition, type RoomMember } from "@/lib/room";
import { cn } from "@/lib/utils";

/** How far a playing listener may drift from the room before correcting. */
const DRIFT_TOLERANCE_S = 0.35;
/** Paused players are re-cued, which is slower, so allow a little more. */
const PAUSED_TOLERANCE_S = 0.5;
const SYNC_INTERVAL_MS = 1000;
/** After a correction, let playback settle before judging it again. */
const SETTLE_MS = 2500;
/**
 * A seek takes a moment to buffer, so a player lands behind where it
 * was sent. Corrections aim ahead by a lead learned from how each one
 * lands, starting from this guess.
 */
const INITIAL_SEEK_LEAD_S = 0.25;
const MAX_SEEK_LEAD_S = 1.5;
/** How long a local play/pause/seek waits for the room to confirm it. */
const INTENT_TIMEOUT_MS = 3000;

export function RoomView({ roomId }: { roomId: string }) {
  const name = useDisplayName();
  const { room, members, status, connected, actionError, send, serverNow } =
    useRoom(roomId, name);
  const [playbackError, setPlaybackError] = useState("");

  const queue = room?.queue;
  const playback = room?.playback;
  const current = (playback && queue?.[playback.index]) || null;
  const active = status === "ready";

  const queuedSongIds = useMemo(() => {
    if (!queue || !playback) return new Set<string>();
    return new Set(
      queue.slice(Math.max(0, playback.index)).map((song) => song.id)
    );
  }, [queue, playback]);

  const player = useYouTubePlayer({
    onEnded: () => {
      if (current) void send({ type: "next", from: current.queueId });
    },
    onError: (message) => {
      if (!current) return;
      setPlaybackError(`${message} Skipping “${current.title}”.`);
      void send({ type: "next", from: current.queueId });
    },
  });

  const {
    load,
    stop,
    seek,
    resume,
    pause,
    getCurrentTime,
    autoplayBlocked,
    status: playerStatus,
  } = player;

  /** The queue entry loaded into the player. */
  const loadedRef = useRef<string | null>(null);
  /**
   * Set when this listener plays, pauses or seeks. The player responds
   * right away, so hold off correcting it until the room has applied
   * the change (a newer version arrives), or the wait times out.
   */
  const intentRef = useRef<{ afterVersion: number; until: number } | null>(
    null
  );
  /** When the player was last loaded or corrected, and whether to learn
   * the seek lead from how the correction landed. */
  const correctionRef = useRef({ at: 0, learn: false });
  const seekLeadRef = useRef(INITIAL_SEEK_LEAD_S);

  // The player follows the room: load what the room is playing, at the
  // position it's at, and correct the player if it drifts.
  const sync = useCallback(() => {
    // Nothing plays until this listener has joined the room.
    if (!room || !name || !active) return;
    const { queue, playback } = room;

    const song = queue[playback.index];
    if (!song) {
      if (loadedRef.current) {
        loadedRef.current = null;
        stop();
      }
      return;
    }

    const expected = playbackPosition(playback, serverNow());

    if (loadedRef.current !== song.queueId) {
      loadedRef.current = song.queueId;
      correctionRef.current = { at: Date.now(), learn: false };
      void load(song.id, {
        startSeconds: expected,
        autoplay: playback.playing,
        mayBeBlocked: true,
      });
      return;
    }

    const intent = intentRef.current;
    if (intent) {
      if (room.version <= intent.afterVersion && Date.now() < intent.until) {
        return;
      }
      intentRef.current = null;
    }

    /** Seeks to where the room will be once the seek has buffered. */
    function correct() {
      correctionRef.current = { at: Date.now(), learn: true };
      seek(expected + seekLeadRef.current);
    }

    // Positive when this listener is ahead of the room.
    const drift = getCurrentTime() - expected;

    if (playback.playing) {
      // Wait while blocked (resumes on a click), buffering, or after a
      // song ends here first (the room moves on once it hears about it).
      if (playerStatus === "paused" && !autoplayBlocked) {
        correct();
        resume();
        return;
      }
      if (playerStatus !== "playing") return;

      const correction = correctionRef.current;
      if (Date.now() - correction.at < SETTLE_MS) return;
      if (correction.learn) {
        // Landed behind: aim further ahead next time, and vice versa.
        correction.learn = false;
        seekLeadRef.current = Math.min(
          MAX_SEEK_LEAD_S,
          Math.max(0, seekLeadRef.current - drift)
        );
      }
      if (Math.abs(drift) > DRIFT_TOLERANCE_S) correct();
      return;
    }

    const drifted = Math.abs(drift) > PAUSED_TOLERANCE_S;
    if (playerStatus === "playing" || playerStatus === "loading") {
      pause();
      if (drifted) seek(expected);
    } else if (playerStatus === "ended" || drifted) {
      // Re-cue rather than seek: seeking a cued video starts playing it.
      void load(song.id, { startSeconds: expected, autoplay: false });
    }
  }, [
    room,
    name,
    active,
    serverNow,
    load,
    stop,
    seek,
    resume,
    pause,
    getCurrentTime,
    playerStatus,
    autoplayBlocked,
  ]);

  useEffect(() => {
    sync();
  }, [sync]);

  const playing = playback?.playing ?? false;
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(sync, SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [playing, sync]);

  // Silence the player as soon as the room is gone or this listener was
  // removed: it lives outside React and would otherwise keep playing.
  useEffect(() => {
    if (status === "loading" || status === "ready") return;
    loadedRef.current = null;
    stop();
  }, [status, stop]);

  useResumeOnGesture(autoplayBlocked, resume);

  if (status === "removed") {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 px-4">
        <Empty className="max-w-md border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserX />
            </EmptyMedia>
            <EmptyTitle>You were removed from this room</EmptyTitle>
            <EmptyDescription>
              The host removed you, so you can&apos;t rejoin it. You can
              still start your own room.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/rooms/new" />}>
              Start a room
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (status === "not-found" || status === "error") {
    const notFound = status === "not-found";
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 px-4">
        <Empty className="max-w-md border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {notFound ? <DoorClosed /> : <AlertCircle />}
            </EmptyMedia>
            <EmptyTitle>
              {notFound ? "Room not found" : "Couldn't load the room"}
            </EmptyTitle>
            <EmptyDescription>
              {notFound
                ? "This room has closed, or the link is wrong. Ask for a new link or start your own room."
                : "Check your connection and reload the page."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/rooms/new" />}>
              Start a room
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (!room || !queue || !playback) return <RoomSkeleton />;

  if (!name) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-10">
        <JoinRoomForm roomName={room.name} />
      </div>
    );
  }

  function markIntent() {
    intentRef.current = {
      afterVersion: room!.version,
      until: Date.now() + INTENT_TIMEOUT_MS,
    };
  }

  function handleTogglePlay() {
    if (!current) return;
    markIntent();
    // Go by what this listener hears: if autoplay was blocked, pressing
    // play should start it here rather than pause the room.
    if (playerStatus === "playing" || playerStatus === "loading") {
      pause();
      void send({ type: "pause" });
    } else {
      resume();
      void send({ type: "play" });
    }
  }

  function handleSeek(seconds: number) {
    // While paused, the room's update re-cues the player at the new spot.
    if (playback!.playing) {
      markIntent();
      seek(seconds);
    }
    void send({ type: "seek", position: seconds });
  }

  function handleRemoveMember(member: RoomMember) {
    if (
      window.confirm(
        `Remove ${member.name} from the room? They won't be able to rejoin.`
      )
    ) {
      void send({ type: "removeMember", memberId: member.id });
    }
  }

  function handlePrevious() {
    if (!current) return;
    if (getCurrentTime() > 3 || playback!.index === 0) handleSeek(0);
    else void send({ type: "previous", from: current.queueId });
  }

  return (
    <div className="flex flex-1 justify-center bg-muted/40">
      <main
        className={cn(
          "flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14",
          current && "pb-40 sm:pb-36"
        )}
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <Button
              variant="link"
              size="sm"
              className="self-start px-0 text-muted-foreground"
              nativeButton={false}
              render={<Link href="/" />}
            >
              <ArrowLeft data-icon="inline-start" />
              Jam Rooms
            </Button>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {room.name}
            </h1>
            <div className="mt-2">
              <RoomMembers
                members={members}
                ownerId={room.ownerId}
                you={room.you}
                connected={connected}
                onRemove={handleRemoveMember}
              />
            </div>
          </div>
          <ShareRoomButton />
        </header>

        {actionError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>That didn&apos;t go through</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <RoomQueue
            queue={queue}
            currentIndex={playback.index}
            playing={playback.playing}
            onJump={(queueId) => {
              setPlaybackError("");
              void send({ type: "jump", queueId });
            }}
            onRemove={(queueId) => void send({ type: "remove", queueId })}
            className="max-h-80 lg:sticky lg:top-6 lg:order-last lg:max-h-[calc(100svh-12rem)]"
          />

          <div className="flex min-w-0 flex-col gap-8">
            <SongBrowser
              heading={
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Add songs
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Anything you pick joins the queue for everyone.
                  </p>
                </div>
              }
              notice={
                playbackError && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Couldn&apos;t play track</AlertTitle>
                    <AlertDescription>{playbackError}</AlertDescription>
                  </Alert>
                )
              }
              currentSongId={current?.id}
              cardAction="add"
              queuedSongIds={queuedSongIds}
              onSelect={(song) => {
                setPlaybackError("");
                void send({ type: "add", song, addedBy: name });
              }}
              gridClassName="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
            />
          </div>
        </div>
      </main>

      {current && (
        <PlayerBar
          song={current}
          status={playerStatus}
          currentTime={player.currentTime}
          duration={player.duration}
          volume={player.volume}
          muted={player.muted}
          resumePending={autoplayBlocked}
          hasPrevious={playback.index > 0}
          hasNext={playback.index < queue.length - 1}
          onTogglePlay={handleTogglePlay}
          onPrevious={handlePrevious}
          onNext={() => void send({ type: "next", from: current.queueId })}
          onSeek={handleSeek}
          onVolumeChange={player.setVolume}
          onToggleMute={player.toggleMute}
        />
      )}
    </div>
  );
}

export function RoomSkeleton() {
  return (
    <div className="flex flex-1 justify-center bg-muted/40">
      <div className="flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-64 lg:order-last" />
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}
