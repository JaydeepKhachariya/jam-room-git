"use client";

import { memo, useCallback } from "react";
import { AlertCircle } from "lucide-react";

import {
  useNowPlaying,
  usePlayer,
  usePlayerActions,
} from "@/components/player/player-provider";
import { SongCard } from "@/components/song-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Song } from "@/lib/song";

/**
 * A song card that plays through your own player. Memoized, and it only
 * reads what it needs, so a long list doesn't re-render as music plays.
 */
export const PlayableSongCard = memo(function PlayableSongCard({
  song,
  index,
  songs,
}: {
  song: Song;
  index: number;
  songs: Song[];
}) {
  const { playFromList, addToQueue } = usePlayerActions();
  const { currentId, isPlaying } = useNowPlaying();
  const isCurrent = currentId === song.id;

  const onSelect = useCallback(
    () => playFromList(songs, index),
    [playFromList, songs, index]
  );
  const onAddToQueue = useCallback(() => addToQueue(song), [addToQueue, song]);

  return (
    <SongCard
      song={song}
      isCurrent={isCurrent}
      playing={isCurrent && isPlaying}
      onSelect={onSelect}
      onAddToQueue={onAddToQueue}
    />
  );
});

export const renderPlayableSong = (song: Song, index: number, songs: Song[]) => (
  <PlayableSongCard key={song.id} song={song} index={index} songs={songs} />
);

/** Why the last song couldn't play, if it couldn't. */
export function PlayerErrorNotice() {
  const { error } = usePlayer();
  if (!error) return null;

  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Couldn&apos;t play track</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
