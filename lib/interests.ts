"use client";

import { createLocalStore } from "@/lib/local-store";
import { readLikedSongs } from "@/lib/library";
import { isSong, type Song } from "@/lib/song";

const MAX_HISTORY = 30;
const RECENT_SEEDS = 3;
const LIKED_SEEDS = 2;

/** What this browser has played lately, newest first. */
const history = createLocalStore<Song[]>(
  "jam-rooms:history",
  (value) => (Array.isArray(value) ? value.filter(isSong) : []),
  []
);

export function recordPlay(song: Song) {
  history.update((songs) =>
    [
      {
        id: song.id,
        title: song.title,
        artists: song.artists,
        thumbnail: song.thumbnail,
        ...(song.duration ? { duration: song.duration } : {}),
      },
      ...songs.filter((entry) => entry.id !== song.id),
    ].slice(0, MAX_HISTORY)
  );
}

/**
 * The songs that stand for this listener's taste: what they're on right
 * now, what they played lately and what they liked.
 */
function interestSeeds(first: string[] = []) {
  const ids = [
    ...first,
    ...history.read().slice(0, RECENT_SEEDS).map((song) => song.id),
    ...readLikedSongs().slice(0, LIKED_SEEDS).map((song) => song.id),
  ];
  return [...new Set(ids)].slice(0, 5);
}

/**
 * The suggestions feed for this listener: songs like what they've been
 * playing, or the generic feed while they have no history. Read once
 * when a page opens, so playing music doesn't reshuffle the page.
 */
export function suggestionsUrl(first: string[] = []) {
  const seeds = interestSeeds(first);
  return seeds.length > 0
    ? `/api/suggestions?seeds=${seeds.join(",")}`
    : "/api/suggestions";
}
