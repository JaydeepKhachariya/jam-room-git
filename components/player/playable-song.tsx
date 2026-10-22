"use client";

import { AlertCircle } from "lucide-react";

import { usePlayer } from "@/components/player/player-provider";
import { SongCard } from "@/components/song-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Song } from "@/lib/song";

/** A song card that plays through your own player. */
export function PlayableSongCard({
  song,
  index,
  songs,
}: {
  song: Song;
  index: number;
  songs: Song[];
}) {
  const player = usePlayer();

  return (
    <SongCard
      song={song}
      isCurrent={player.current?.id === song.id}
      playing={player.isPlaying}
      onSelect={() => player.playFromList(songs, index)}
      onAddToQueue={() => player.addToQueue(song)}
    />
  );
}

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
