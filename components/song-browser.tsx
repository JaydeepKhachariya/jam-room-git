"use client";

import { FormEvent, ReactNode, useState } from "react";
import { AlertCircle, Music, Search, Sparkles, X } from "lucide-react";

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
import type { Song } from "@/lib/song";

const GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

interface SongBrowserProps {
  /** Shown beside the search box. */
  heading: ReactNode;
  /** Shown between the search box and the results, e.g. an error. */
  notice?: ReactNode;
  currentSongId?: string | null;
  cardAction?: "play" | "add";
  /** Ids of songs already in the queue, marked on their cards. */
  queuedSongIds?: ReadonlySet<string>;
  onSelect: (song: Song, index: number, songs: Song[]) => void;
  gridClassName?: string;
}

/** Song search with suggestions shown until the first search. */
export function SongBrowser({
  heading,
  notice,
  currentSongId,
  cardAction,
  queuedSongIds,
  onSelect,
  gridClassName = GRID_CLASS,
}: SongBrowserProps) {
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
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {heading}

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

      {notice}

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
          <div className={gridClassName}>
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
          <div className={gridClassName}>
            {songs.map((song, index) => (
              <SongCard
                key={song.id}
                song={song}
                isCurrent={currentSongId === song.id}
                action={cardAction}
                queued={queuedSongIds?.has(song.id)}
                onSelect={() => onSelect(song, index, songs)}
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
    </>
  );
}
