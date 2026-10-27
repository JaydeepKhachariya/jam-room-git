"use client";

import Link from "next/link";
import { ExternalLink, Heart, Music, Pause, Play } from "lucide-react";

import {
  usePlayer,
  usePlayerProgress,
} from "@/components/player/player-provider";
import {
  PlayerErrorNotice,
  renderPlayableSong,
} from "@/components/player/playable-song";
import { PageMain, SectionHeader } from "@/components/shell/layout-parts";
import { PersonalPanel } from "@/components/shell/personal-panel";
import { EmptySongs, SongFeedGrid } from "@/components/song-grid";
import { SongThumbnail } from "@/components/song-thumbnail";
import { Spinner } from "@/components/ui/spinner";
import { useSongFeed } from "@/hooks/use-song-feed";
import { formatTime } from "@/lib/format";
import { toggleLiked, useLikedSongs } from "@/lib/library";
import { cn } from "@/lib/utils";

/** The song your own player is on: artwork, details, and songs like it. */
export function NowPlayingView() {
  const player = usePlayer();
  const song = player.current;
  const related = useSongFeed(
    song ? `/api/radio?id=${encodeURIComponent(song.id)}` : null
  );

  return (
    <>
      <PageMain>
        {song ? (
          <>
            <NowPlayingHero />
            <PlayerErrorNotice />
            <section className="flex flex-col gap-3">
              <SectionHeader title="More like this" />
              <SongFeedGrid
                feed={related}
                feedKey={song.id}
                errorTitle="Couldn't load similar songs"
                emptyTitle="Nothing similar found"
                emptyDescription="Try another song to see more like it."
                renderCard={renderPlayableSong}
              />
            </section>
          </>
        ) : (
          <EmptySongs
            icon={<Music />}
            title="Nothing playing"
            description="Pick a song and its details will show up here."
          >
            <Link
              href="/"
              className="flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Browse songs
            </Link>
          </EmptySongs>
        )}
      </PageMain>
      <PersonalPanel />
    </>
  );
}

function NowPlayingHero() {
  const player = usePlayer();
  const { currentTime, duration } = usePlayerProgress();
  const { isLiked } = useLikedSongs();
  const song = player.current;
  if (!song) return null;

  const liked = isLiked(song.id);
  const length = duration || song.duration || 0;
  const progress = length ? Math.min(currentTime / length, 1) : 0;
  const upcoming = Math.max(0, player.queue.length - player.queueIndex - 1);
  const isLoading = player.status === "loading";

  return (
    <header className="relative isolate flex flex-col gap-6 overflow-hidden rounded-2xl border p-5 sm:flex-row sm:items-end sm:p-7">
      {/* The artwork, blurred, tints the backdrop. */}
      {song.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={song.thumbnail}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-30 blur-3xl"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/20" />

      <div className="aspect-square w-full max-w-64 shrink-0 self-center overflow-hidden rounded-xl bg-muted shadow-2xl sm:w-56 sm:self-auto">
        <SongThumbnail
          src={song.thumbnail}
          label={song.title}
          iconClassName="text-6xl"
          loading="eager"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {player.isPlaying ? "Now playing" : "Paused"}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {song.title}
          </h1>
          <p className="text-muted-foreground">
            {song.artists.join(", ") || "Unknown artist"}
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Detail label="Length" value={length ? formatTime(length) : "—"} />
          <Detail
            label="Position"
            value={`${formatTime(currentTime)} (${Math.round(progress * 100)}%)`}
          />
          <Detail
            label="Up next"
            value={upcoming === 1 ? "1 song" : `${upcoming} songs`}
          />
        </dl>

        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(length)}
          aria-valuenow={Math.round(currentTime)}
          className="h-1 w-full overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={player.togglePlay}
            className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground outline-none transition-transform hover:scale-[1.03] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {isLoading ? (
              <Spinner className="size-4" />
            ) : player.isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            {player.isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            aria-pressed={liked}
            onClick={() => toggleLiked(song)}
            className="flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Heart className={cn("size-4", liked && "fill-current")} />
            {liked ? "Saved" : "Save"}
          </button>
          <a
            href={`https://music.youtube.com/watch?v=${encodeURIComponent(song.id)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ExternalLink className="size-4" />
            YouTube Music
          </a>
        </div>
      </div>
    </header>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
