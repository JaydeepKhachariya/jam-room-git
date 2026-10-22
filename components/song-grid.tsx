"use client";

import type { ReactNode } from "react";
import { AlertCircle, Music } from "lucide-react";

import { InfiniteScrollTrigger } from "@/components/infinite-scroll-trigger";
import { SongCardSkeleton } from "@/components/song-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { useSongFeed } from "@/hooks/use-song-feed";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

/** Cards at least 150px wide, as many per row as fit. */
export const SONG_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4";

export function SongGrid({
  songs,
  renderCard,
  children,
  className,
}: {
  songs: Song[];
  renderCard: (song: Song, index: number, songs: Song[]) => ReactNode;
  /** Shown after the cards, e.g. skeletons while more load. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(SONG_GRID_CLASS, className)}>
      {songs.map((song, index) => renderCard(song, index, songs))}
      {children}
    </div>
  );
}

export function SongGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={SONG_GRID_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        <SongCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function EmptySongs({
  icon = <Music />,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  );
}

/** A song feed: loading, errors, the cards, and loading more on scroll. */
export function SongFeedGrid({
  feed,
  feedKey,
  errorTitle,
  emptyTitle,
  emptyDescription,
  renderCard,
}: {
  feed: ReturnType<typeof useSongFeed>;
  /** Changes with the feed, so each one observes its own list. */
  feedKey: string;
  errorTitle: string;
  emptyTitle: string;
  emptyDescription: ReactNode;
  renderCard: (song: Song, index: number, songs: Song[]) => ReactNode;
}) {
  const { songs, loading, error } = feed;

  if (loading) return <SongGridSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{errorTitle}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (songs.length === 0) {
    return <EmptySongs title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <SongGrid songs={songs} renderCard={renderCard}>
        {feed.loadingMore &&
          Array.from({ length: 4 }, (_, index) => (
            <SongCardSkeleton key={`more-${index}`} />
          ))}
      </SongGrid>

      <InfiniteScrollTrigger
        key={feedKey}
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
  );
}
