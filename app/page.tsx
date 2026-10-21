"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Music, Users } from "lucide-react";

import { PlayerBar } from "@/components/player-bar";
import { SongBrowser } from "@/components/song-browser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useResumeOnGesture } from "@/hooks/use-resume-on-gesture";
import { useYouTubePlayer } from "@/hooks/use-youtube-player";
import {
  readPlaybackSession,
  writePlaybackSession,
} from "@/lib/playback-session";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

export default function Home() {
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [playbackError, setPlaybackError] = useState("");

  const currentSong = queue[queueIndex] ?? null;
  const hasNext = queueIndex < queue.length - 1;
  const hasPrevious = queueIndex > 0;

  const player = useYouTubePlayer({
    onEnded: () => playAt(queue, queueIndex + 1),
    onError: (message) => {
      if (hasNext) {
        playAt(queue, queueIndex + 1);
        setPlaybackError(`${message} Skipped to the next track.`);
      } else {
        setPlaybackError(message);
      }
    },
  });

  const {
    whenReady,
    load,
    resume,
    setVolume,
    setMuted,
    autoplayBlocked,
    status,
    currentTime,
    duration,
    volume,
    muted,
  } = player;

  // Restore the last session after a reload: same queue, track and position.
  useEffect(() => {
    const saved = readPlaybackSession();
    if (!saved) return;

    let cancelled = false;

    void whenReady().then(() => {
      if (cancelled) return;
      setQueue(saved.queue);
      setQueueIndex(saved.index);
      setVolume(saved.volume);
      setMuted(saved.muted);
      void load(saved.queue[saved.index].id, {
        startSeconds: saved.position,
        duration: saved.duration,
        autoplay: saved.wasPlaying,
        mayBeBlocked: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [whenReady, load, setVolume, setMuted]);

  // Keep the session saved so a reload can pick up where it left off.
  useEffect(() => {
    if (!currentSong) return;

    writePlaybackSession({
      queue,
      index: queueIndex,
      position: currentTime,
      duration,
      volume,
      muted,
      // A blocked resume still counts as "playing": the user never paused it.
      wasPlaying:
        status === "playing" || status === "loading" || autoplayBlocked,
    });
  }, [
    currentSong,
    queue,
    queueIndex,
    currentTime,
    duration,
    volume,
    muted,
    status,
    autoplayBlocked,
  ]);

  useResumeOnGesture(autoplayBlocked, resume);

  function playAt(nextQueue: Song[], index: number) {
    const song = nextQueue[index];
    if (!song) return;
    setQueue(nextQueue);
    setQueueIndex(index);
    setPlaybackError("");
    void player.load(song.id);
  }

  function handlePrevious() {
    if (player.currentTime > 3 || !hasPrevious) player.seek(0);
    else playAt(queue, queueIndex - 1);
  }

  return (
    <div className="flex flex-1 justify-center bg-muted/40">
      <main
        className={cn(
          "flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14",
          currentSong && "pb-40 sm:pb-36"
        )}
      >
        <SongBrowser
          heading={
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <Music className="size-6" />
                  Jam Rooms
                </h1>
                <p className="text-sm text-muted-foreground">
                  Pick a song and press play, or start a room to listen with
                  friends.
                </p>
              </div>
              <Button
                variant="outline"
                className="self-start"
                nativeButton={false}
                render={<Link href="/rooms/new" />}
              >
                <Users data-icon="inline-start" />
                Start a room
              </Button>
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
          currentSongId={currentSong?.id}
          onSelect={(_song, index, songs) => playAt(songs, index)}
        />
      </main>

      {currentSong && (
        <PlayerBar
          song={currentSong}
          status={status}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          muted={muted}
          resumePending={autoplayBlocked}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          onTogglePlay={player.togglePlay}
          onPrevious={handlePrevious}
          onNext={() => playAt(queue, queueIndex + 1)}
          onSeek={player.seek}
          onVolumeChange={player.setVolume}
          onToggleMute={player.toggleMute}
        />
      )}
    </div>
  );
}
