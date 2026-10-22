"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertCircle, ArrowLeft, DoorClosed, UserX } from "lucide-react";

import { usePlayerShell } from "@/components/player/player-provider";
import { PlayerBar } from "@/components/player-bar";
import { QueueList } from "@/components/queue-panel";
import { JoinRoomForm } from "@/components/room/join-room-form";
import { RoomMembers } from "@/components/room/room-members";
import { ShareRoomButton } from "@/components/room/share-room-button";
import { SearchForm } from "@/components/search-form";
import {
  PageMain,
  SectionHeader,
  SidePanel,
} from "@/components/shell/layout-parts";
import { StartRoomLink } from "@/components/shell/sidebar";
import { SongCard } from "@/components/song-card";
import { SongFeedGrid, SongGridSkeleton } from "@/components/song-grid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useSongFeed } from "@/hooks/use-song-feed";
import { useYouTubePlayer } from "@/hooks/use-youtube-player";
import { forgetRooms, rememberRoom } from "@/lib/my-rooms";
import { playbackPosition, type RoomMember } from "@/lib/room";

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

  // While a room is open it does the playing: the shell pauses your own
  // player and shows this room's bar instead.
  const { setRoomActive, footerSlot, setPanelOpen } = usePlayerShell();
  useEffect(() => {
    setRoomActive(true);
    return () => setRoomActive(false);
  }, [setRoomActive]);

  // Remember it under "Your rooms"; forget it once it's gone.
  const roomName = room?.name;
  useEffect(() => {
    if (active && name && roomName) rememberRoom(roomId, roomName);
  }, [active, name, roomId, roomName]);
  useEffect(() => {
    if (status === "not-found" || status === "removed") forgetRooms([roomId]);
  }, [status, roomId]);

  // Song search; suggestions until something is searched.
  const [search, setSearch] = useState<string | null>(null);
  const feed = useSongFeed(
    search ? `/api/search?q=${encodeURIComponent(search)}` : "/api/suggestions"
  );

  if (status === "removed") {
    return (
      <CenteredState
        icon={<UserX />}
        title="You were removed from this room"
        description="The host removed you, so you can't rejoin it. You can still start your own room."
      />
    );
  }

  if (status === "not-found" || status === "error") {
    const notFound = status === "not-found";
    return (
      <CenteredState
        icon={notFound ? <DoorClosed /> : <AlertCircle />}
        title={notFound ? "Room not found" : "Couldn't load the room"}
        description={
          notFound
            ? "This room has closed, or the link is wrong. Ask for a new link or start your own room."
            : "Check your connection and reload the page."
        }
      />
    );
  }

  if (!room || !queue || !playback) return <RoomSkeleton />;

  if (!name) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-10">
        <JoinRoomForm roomName={room.name} />
      </div>
    );
  }

  const isHost = room.you === room.ownerId;
  // Host-only rooms: everyone can still play, pause and skip, but only
  // the host changes what's in the queue.
  const canEdit = room.open || isHost;

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
    <>
      <PageMain>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 self-start rounded text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ArrowLeft className="size-3.5" />
              Jam Rooms
            </Link>
            <h1 className="truncate text-[1.75rem] leading-tight font-semibold tracking-tight">
              {room.name}
            </h1>
            <RoomMembers
              members={members}
              ownerId={room.ownerId}
              you={room.you}
              connected={connected}
              onRemove={handleRemoveMember}
            />
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

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
          <div className="flex min-w-56 flex-1 flex-col gap-0.5">
            <h2 className="text-base font-semibold">Add songs</h2>
            <p className="text-muted-foreground">
              {canEdit
                ? "Anything you pick joins the queue for everyone."
                : "Only the host can add songs in this room."}
            </p>
          </div>
          <SearchForm
            key={search ?? ""}
            defaultValue={search ?? ""}
            primary
            searching={search !== null && feed.loading}
            onSearch={setSearch}
            onClear={() => setSearch(null)}
            className="flex-[1_1_20rem]"
          />
        </section>

        {playbackError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Couldn&apos;t play track</AlertTitle>
            <AlertDescription>{playbackError}</AlertDescription>
          </Alert>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeader
            title={
              search ? <>Results for &ldquo;{search}&rdquo;</> : "Suggested for you"
            }
            action={
              search && (
                <button
                  type="button"
                  onClick={() => setSearch(null)}
                  className="shrink-0 rounded text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Back to suggestions
                </button>
              )
            }
          />
          <SongFeedGrid
            feed={feed}
            feedKey={search ?? "suggestions"}
            errorTitle={search ? "Search failed" : "Couldn't load suggestions"}
            emptyTitle={search ? "No songs found" : "No suggestions right now"}
            emptyDescription={
              search
                ? "Try a different title or artist."
                : "Search for any song or artist to get started."
            }
            renderCard={(song) => (
              <SongCard
                key={song.id}
                song={song}
                action="add"
                isCurrent={current?.id === song.id}
                queued={queuedSongIds.has(song.id)}
                readOnly={!canEdit}
                onSelect={() => {
                  setPlaybackError("");
                  void send({ type: "add", song, addedBy: name });
                }}
              />
            )}
          />
        </section>
      </PageMain>

      <SidePanel label="Queue">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">Queue</h2>
          <span className="text-xs text-muted-foreground">
            {queue.length === 0
              ? "Shared with everyone in the room."
              : `${queue.length} ${queue.length === 1 ? "song" : "songs"} · ${
                  canEdit ? "drag to reorder" : "only the host can change it"
                }`}
          </span>
        </div>
        <QueueList
          queue={queue}
          currentIndex={playback.index}
          playing={playback.playing}
          emptyText="Nothing queued. Add a song to get started."
          detail={(song) => `added by ${song.addedBy}`}
          editable={canEdit}
          onJump={(queueId) => {
            setPlaybackError("");
            void send({ type: "jump", queueId });
          }}
          onRemove={(queueId) => void send({ type: "remove", queueId })}
          onMove={(queueId, afterQueueId) =>
            void send({ type: "move", queueId, afterQueueId })
          }
        />
      </SidePanel>

      {footerSlot &&
        current &&
        createPortal(
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
            onOpenQueue={() => setPanelOpen(true)}
          />,
          footerSlot
        )}
    </>
  );
}

function CenteredState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-10">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <StartRoomLink />
        </EmptyContent>
      </Empty>
    </div>
  );
}

export function RoomSkeleton() {
  return (
    <>
      <PageMain>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <SongGridSkeleton />
      </PageMain>
      <aside className="hidden w-[22rem] shrink-0 flex-col gap-3 border-l px-4 py-5 xl:flex">
        <Skeleton className="h-10" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </aside>
    </>
  );
}
