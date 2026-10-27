"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  PlayerErrorNotice,
  renderPlayableSong,
} from "@/components/player/playable-song";
import { RoomCard } from "@/components/rooms/room-cards";
import { SearchForm } from "@/components/search-form";
import { PageMain, SectionHeader } from "@/components/shell/layout-parts";
import { PersonalPanel } from "@/components/shell/personal-panel";
import { useRoomsDirectory } from "@/components/shell/rooms-directory";
import { SongFeedGrid } from "@/components/song-grid";
import { useSongFeed } from "@/hooks/use-song-feed";
import { suggestionsUrl } from "@/lib/interests";
import { cn } from "@/lib/utils";

/** Each chip is a song search; "All" is the suggestions feed. */
const CHIPS = [
  { label: "All", query: null },
  { label: "Trending", query: "trending songs" },
  { label: "Bollywood", query: "bollywood hits" },
  { label: "Hip-hop", query: "hip hop hits" },
  { label: "Chill", query: "chill vibes" },
] as const;

type ChipLabel = (typeof CHIPS)[number]["label"];

function greetingFor(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const noSubscribe = () => () => {};

export function HomeView() {
  const router = useRouter();
  // Uses this device's clock, which the server doesn't know.
  const greeting = useSyncExternalStore(
    noSubscribe,
    () => greetingFor(new Date().getHours()),
    () => "Welcome back"
  );

  // Suggestions follow what you have been playing; fixed while the page is open.
  const [forYouUrl] = useState(() => suggestionsUrl());
  const [chip, setChip] = useState<ChipLabel>("All");
  const query = CHIPS.find((entry) => entry.label === chip)?.query ?? null;
  const feedUrl = query
    ? `/api/search?q=${encodeURIComponent(query)}`
    : forYouUrl;
  const feed = useSongFeed(feedUrl);

  return (
    <>
      <PageMain>
        <header className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
            <p className="text-muted-foreground">
              Pick a song to play, or start a room and listen with friends.
            </p>
          </div>
          <SearchForm
            onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
            className="flex-[1_1_20rem]"
          />
        </header>

        <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-2">
          {CHIPS.map(({ label }) => {
            const selected = label === chip;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setChip(label)}
                className={cn(
                  "h-8 rounded-full border px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <PlayerErrorNotice />

        <LiveRooms />

        <section className="flex flex-col gap-3">
          <SectionHeader title={chip === "All" ? "Suggested for you" : chip} />
          <SongFeedGrid
            feed={feed}
            feedKey={chip}
            errorTitle="Couldn't load songs"
            emptyTitle="Nothing here right now"
            emptyDescription="Search for any song or artist to get started."
            renderCard={renderPlayableSong}
          />
        </section>
      </PageMain>
      <PersonalPanel />
    </>
  );
}

/** Your rooms that have someone listening right now. */
function LiveRooms() {
  const { rooms, live } = useRoomsDirectory();
  if (rooms.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="Live rooms"
        action={
          <Link
            href="/rooms"
            className="rounded text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            View all
          </Link>
        }
      />
      {live.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
          None of your rooms has anyone listening right now.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
          {live.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </section>
  );
}
