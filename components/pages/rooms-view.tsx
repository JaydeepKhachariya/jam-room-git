"use client";

import { Users } from "lucide-react";

import { RoomCard } from "@/components/rooms/room-cards";
import { PageMain, SectionHeader } from "@/components/shell/layout-parts";
import { PersonalPanel } from "@/components/shell/personal-panel";
import { useRoomsDirectory } from "@/components/shell/rooms-directory";
import { StartRoomLink } from "@/components/shell/sidebar";
import { EmptySongs } from "@/components/song-grid";
import { forgetRooms } from "@/lib/my-rooms";

const ROOM_GRID = "grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3";

export function RoomsView() {
  const { rooms, live } = useRoomsDirectory();
  const quiet = rooms.filter((room) => !live.includes(room));

  return (
    <>
      <PageMain>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
            <p className="text-muted-foreground">
              Rooms you&apos;ve started or joined in this browser.
            </p>
          </div>
          <StartRoomLink />
        </header>

        {rooms.length === 0 ? (
          <EmptySongs
            icon={<Users />}
            title="No rooms yet"
            description="Start a room and share its link, or open a link a friend sent you."
          />
        ) : (
          <>
            {live.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionHeader title="Live now" />
                <div className={ROOM_GRID}>
                  {live.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              </section>
            )}
            {quiet.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionHeader title={live.length > 0 ? "Other rooms" : "Your rooms"} />
                <div className={ROOM_GRID}>
                  {quiet.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onForget={() => forgetRooms([room.id])}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </PageMain>
      <PersonalPanel />
    </>
  );
}
