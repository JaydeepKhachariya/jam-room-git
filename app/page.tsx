"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Music, Search, Sparkles, X } from "lucide-react";

import { PlayerBar } from "@/components/player-bar";
import { InfiniteScrollTrigger } from "@/components/infinite-scroll-trigger";
import { SongCard, SongCardSkeleton } from "@/components/song-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useSongFeed } from "@/hooks/use-song-feed";
import { useYouTubePlayer } from "@/hooks/use-youtube-player";
import {
  readPlaybackSession,
  writePlaybackSession,
} from "@/lib/playback-session";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

const GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export default function Home() {
  const [query, setQuery] = useState("");
  // `id` makes re-submitting the same query start a fresh search.
  const [search, setSearch] = useState<{ query: string; id: number } | null>(
    null
  );

  const suggestions = useSongFeed("/api/suggestions");
  const results = useSongFeed(
    search
      ? `/api/search?q=${encodeURIComponent(search.query)}&n=${search.id}`
      : null
  );

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

  // Browsers block audio that starts without a user gesture. If resuming
  // after reload was blocked, continue on the first click or key press.
  useEffect(() => {
    if (!autoplayBlocked) return;

    function handleGesture(event: Event) {
      const target = event.target;
      // The player bar's own controls handle play/pause themselves.
      if (target instanceof Element && target.closest("[data-player-bar]")) {
        return;
      }
      resume();
    }

    document.addEventListener("click", handleGesture, true);
    document.addEventListener("keydown", handleGesture, true);

    return () => {
      document.removeEventListener("click", handleGesture, true);
      document.removeEventListener("keydown", handleGesture, true);
    };
  }, [autoplayBlocked, resume]);

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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const searchQuery = query.trim();
    if (!searchQuery) return;

    setSearch((prev) => ({ query: searchQuery, id: (prev?.id ?? 0) + 1 }));
  }

  function clearSearch() {
    setQuery("");
    setSearch(null);
  }

  const searchedQuery = search?.query ?? "";
  const isSearchView = search !== null;
  const searching = results.loading;
  const feed = isSearchView ? results : suggestions;
  const { songs, loading, error } = feed;

  return (
    <div className="flex flex-1 justify-center bg-muted/40">
      <main
        className={cn(
          "flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14",
          currentSong && "pb-40 sm:pb-36"
        )}
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Music className="size-6" />
              Jam Rooms
            </h1>
            <p className="text-sm text-muted-foreground">
              Pick a song and press play.
            </p>
          </div>

          <form onSubmit={handleSearch} className="w-full sm:max-w-md">
            <InputGroup className="h-10 bg-background">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search songs or artists..."
                aria-label="Search songs or artists"
                maxLength={200}
                required
              />
              <InputGroupAddon align="inline-end">
                {query && (
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    onClick={clearSearch}
                  >
                    <X />
                  </InputGroupButton>
                )}
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={searching}
                >
                  {searching ? <Spinner /> : null}
                  {searching ? "Searching" : "Search"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </header>

        {playbackError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Couldn&apos;t play track</AlertTitle>
            <AlertDescription>{playbackError}</AlertDescription>
          </Alert>
        )}

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">
              {isSearchView ? (
                <>
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    Results for &ldquo;{searchedQuery}&rdquo;
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4 shrink-0 text-muted-foreground" />
                  Suggested for you
                </>
              )}
            </h2>
            {isSearchView && (
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                Back to suggestions
              </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>
                {isSearchView ? "Search failed" : "Couldn't load suggestions"}
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className={GRID_CLASS}>
              {Array.from({ length: 10 }, (_, index) => (
                <SongCardSkeleton key={index} />
              ))}
            </div>
          )}

          {!loading && !error && songs.length === 0 && (
            <Empty className="border bg-background">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {isSearchView ? <Search /> : <Music />}
                </EmptyMedia>
                <EmptyTitle>
                  {isSearchView ? "No songs found" : "No suggestions right now"}
                </EmptyTitle>
                <EmptyDescription>
                  {isSearchView ? (
                    <>
                      Nothing matched &ldquo;{searchedQuery}&rdquo;. Try a
                      different title or artist.
                    </>
                  ) : (
                    "Search for any song or artist to get started."
                  )}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!loading && songs.length > 0 && (
            <div className={GRID_CLASS}>
              {songs.map((song, index) => (
                <SongCard
                  key={song.id}
                  song={song}
                  isCurrent={currentSong?.id === song.id}
                  onPlay={() => playAt(songs, index)}
                />
              ))}
              {feed.loadingMore &&
                Array.from({ length: 5 }, (_, index) => (
                  <SongCardSkeleton key={`more-${index}`} />
                ))}
            </div>
          )}

          {!loading && songs.length > 0 && (
            <>
              <InfiniteScrollTrigger
                // Remount per feed so each view observes its own list.
                key={isSearchView ? `search-${search.id}` : "suggestions"}
                onLoadMore={feed.loadMore}
                disabled={!feed.hasMore || feed.loadingMore}
                itemCount={songs.length}
              />

              {feed.loadMoreError ? (
                <p className="text-center text-sm text-destructive" role="status">
                  {feed.loadMoreError}
                </p>
              ) : (
                !feed.hasMore && (
                  <p className="text-center text-sm text-muted-foreground">
                    You&apos;ve reached the end.
                  </p>
                )
              )}
            </>
          )}
        </section>
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
