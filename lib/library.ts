"use client";

import { useMemo } from "react";

import { createLocalStore } from "@/lib/local-store";
import { isSong, type Song } from "@/lib/song";

const MAX_LIKED = 500;

/** Liked songs, newest first, saved in this browser. */
const liked = createLocalStore<Song[]>(
  "jam-rooms:liked",
  (value) => (Array.isArray(value) ? value.filter(isSong) : []),
  []
);

export function useLikedSongs() {
  const songs = liked.useValue();
  const ids = useMemo(() => new Set(songs.map((song) => song.id)), [songs]);
  return { songs, isLiked: (songId: string) => ids.has(songId) };
}

export function toggleLiked(song: Song) {
  liked.update((songs) =>
    songs.some((entry) => entry.id === song.id)
      ? songs.filter((entry) => entry.id !== song.id)
      : [
          {
            id: song.id,
            title: song.title,
            artists: song.artists,
            thumbnail: song.thumbnail,
            ...(song.duration ? { duration: song.duration } : {}),
          },
          ...songs,
        ].slice(0, MAX_LIKED)
  );
}
