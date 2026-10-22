"use client";

import Link from "next/link";
import { Music, Plus } from "lucide-react";

import { roomStatus } from "@/components/rooms/room-cards";
import { usePlayerShell } from "@/components/player/player-provider";
import { NavLinks } from "@/components/shell/nav-links";
import { useRoomsDirectory } from "@/components/shell/rooms-directory";
import { paletteFor } from "@/components/song-thumbnail";
import { cn } from "@/lib/utils";

/** How many of your rooms the sidebar lists. */
const SIDEBAR_ROOMS = 5;

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Music className="size-[18px]" />
      </span>
      <span className="text-base font-semibold tracking-tight">Jam Rooms</span>
    </Link>
  );
}

export function StartRoomLink({ className }: { className?: string }) {
  return (
    <Link
      href="/rooms/new"
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <Plus className="size-4" />
      Start a room
    </Link>
  );
}

function YourRooms() {
  const { rooms } = useRoomsDirectory();
  if (rooms.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="px-3 text-xs font-medium tracking-wide text-muted-foreground">
        Your rooms
      </div>
      <ul className="flex flex-col">
        {rooms.slice(0, SIDEBAR_ROOMS).map((room) => {
          const live = (room.members?.length ?? 0) > 0;
          return (
            <li key={room.id}>
              <Link
                href={`/rooms/${room.id}`}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className="size-7 shrink-0 rounded-md"
                  style={{ background: paletteFor(room.name).background }}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{room.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {roomStatus(room)}
                  </span>
                </span>
                {live && (
                  <span
                    role="img"
                    aria-label="Live"
                    className="size-2 shrink-0 rounded-full bg-[#22c55e]"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const { roomActive } = usePlayerShell();

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r px-4 py-5",
        className
      )}
    >
      <Logo className="px-2" />
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <NavLinks />
      </nav>
      {/* Hidden in a room: watching rooms pauses while you're in one. */}
      {!roomActive && <YourRooms />}
      <StartRoomLink className="mt-auto" />
    </aside>
  );
}

/** The sidebar's navigation, as a top bar on narrow screens. */
export function MobileNav({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4",
        className
      )}
    >
      <Logo />
      <nav aria-label="Main" className="flex items-center gap-1">
        <NavLinks compact />
        <Link
          href="/rooms/new"
          aria-label="Start a room"
          className="ml-1 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" />
        </Link>
      </nav>
    </header>
  );
}
