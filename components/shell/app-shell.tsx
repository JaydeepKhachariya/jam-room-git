"use client";

import type { ReactNode } from "react";

import {
  PlayerProvider,
  usePlayer,
  usePlayerProgress,
  usePlayerShell,
} from "@/components/player/player-provider";
import { PlayerBar } from "@/components/player-bar";
import { RoomsDirectoryProvider } from "@/components/shell/rooms-directory";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { toggleLiked, useLikedSongs } from "@/lib/library";

/**
 * The app frame: sidebar, the page, and the player bar along the
 * bottom. Your own player lives here, so it keeps going between pages.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      <ShellFrame>{children}</ShellFrame>
    </PlayerProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const { roomActive, setFooterSlot } = usePlayerShell();

  return (
    <RoomsDirectoryProvider enabled={!roomActive}>
      <div className="flex h-svh flex-col">
        <MobileNav className="lg:hidden" />
        <div className="flex min-h-0 flex-1">
          <Sidebar className="hidden lg:flex" />
          <div className="flex min-w-0 flex-1">{children}</div>
        </div>
        <footer>
          {/* A room renders its own player bar here. */}
          <div ref={setFooterSlot} />
          {!roomActive && <PersonalPlayerBar />}
        </footer>
      </div>
    </RoomsDirectoryProvider>
  );
}

function PersonalPlayerBar() {
  const player = usePlayer();
  const { currentTime, duration } = usePlayerProgress();
  const { setPanelOpen } = usePlayerShell();
  const { isLiked } = useLikedSongs();
  const song = player.current;
  if (!song) return null;

  return (
    <PlayerBar
      song={song}
      status={player.status}
      currentTime={currentTime}
      duration={duration}
      volume={player.volume}
      muted={player.muted}
      resumePending={player.autoplayBlocked}
      hasPrevious={player.hasPrevious}
      hasNext={player.hasNext}
      onTogglePlay={player.togglePlay}
      onPrevious={player.previous}
      onNext={player.next}
      onSeek={player.seek}
      onVolumeChange={player.setVolume}
      onToggleMute={player.toggleMute}
      liked={isLiked(song.id)}
      onToggleLike={() => toggleLiked(song)}
      shuffle={player.shuffle}
      onToggleShuffle={player.toggleShuffle}
      repeat={player.repeat}
      onCycleRepeat={player.cycleRepeat}
      onOpenQueue={() => setPanelOpen(true)}
      detailsHref="/now-playing"
    />
  );
}
