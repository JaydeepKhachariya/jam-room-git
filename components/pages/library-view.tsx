"use client";

import { Heart } from "lucide-react";

import {
  PlayerErrorNotice,
  renderPlayableSong,
} from "@/components/player/playable-song";
import { PageMain } from "@/components/shell/layout-parts";
import { PersonalPanel } from "@/components/shell/personal-panel";
import { EmptySongs, SongGrid } from "@/components/song-grid";
import { useLikedSongs } from "@/lib/library";

export function LibraryView() {
  const { songs } = useLikedSongs();

  return (
    <>
      <PageMain>
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-muted-foreground">
            {songs.length === 0
              ? "Songs you like, saved in this browser."
              : `${songs.length} liked ${songs.length === 1 ? "song" : "songs"}, saved in this browser.`}
          </p>
        </header>

        <PlayerErrorNotice />

        {songs.length === 0 ? (
          <EmptySongs
            icon={<Heart />}
            title="No liked songs yet"
            description="Tap the heart in the player to save a song here."
          />
        ) : (
          <SongGrid songs={songs} renderCard={renderPlayableSong} />
        )}
      </PageMain>
      <PersonalPanel />
    </>
  );
}
