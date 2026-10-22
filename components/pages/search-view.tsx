"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import {
  PlayerErrorNotice,
  renderPlayableSong,
} from "@/components/player/playable-song";
import { SearchForm } from "@/components/search-form";
import { PageMain, SectionHeader } from "@/components/shell/layout-parts";
import { PersonalPanel } from "@/components/shell/personal-panel";
import { EmptySongs, SongFeedGrid, SongGridSkeleton } from "@/components/song-grid";
import { useSongFeed } from "@/hooks/use-song-feed";

export function SearchView() {
  return (
    <>
      <PageMain>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        {/* The query lives in the URL, which is only known per request. */}
        <Suspense fallback={<SongGridSkeleton />}>
          <SearchResults />
        </Suspense>
      </PageMain>
      <PersonalPanel />
    </>
  );
}

function SearchResults() {
  const router = useRouter();
  const query = (useSearchParams().get("q") ?? "").trim().slice(0, 200);
  const feed = useSongFeed(
    query ? `/api/search?q=${encodeURIComponent(query)}` : null
  );

  return (
    <>
      <SearchForm
        // Remount when the URL changes (e.g. back), so the box follows it.
        key={query}
        defaultValue={query}
        autoFocus={!query}
        primary
        searching={feed.loading}
        onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
        onClear={() => router.push("/search")}
        className="max-w-xl"
      />

      <PlayerErrorNotice />

      {query ? (
        <section className="flex flex-col gap-3">
          <SectionHeader title={<>Results for &ldquo;{query}&rdquo;</>} />
          <SongFeedGrid
            feed={feed}
            feedKey={query}
            errorTitle="Search failed"
            emptyTitle="No songs found"
            emptyDescription={
              <>
                Nothing matched &ldquo;{query}&rdquo;. Try a different title or
                artist.
              </>
            }
            renderCard={renderPlayableSong}
          />
        </section>
      ) : (
        <EmptySongs
          icon={<Search />}
          title="Find something to play"
          description="Search by song title or artist."
        />
      )}
    </>
  );
}
