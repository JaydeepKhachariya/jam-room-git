"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { usePlayer } from "@/components/player/player-provider";
import { QueueList } from "@/components/queue-panel";
import { MemberAvatar } from "@/components/rooms/room-cards";
import { ShareRoomButton } from "@/components/room/share-room-button";
import { SidePanel } from "@/components/shell/layout-parts";
import {
  useRoomsDirectory,
  type DirectoryRoom,
} from "@/components/shell/rooms-directory";
import { StartRoomLink } from "@/components/shell/sidebar";
import { cn } from "@/lib/utils";

type Tab = "queue" | "room";

/** Your queue, and the room you're most likely to want, side by side. */
export function PersonalPanel() {
  const [tab, setTab] = useState<Tab>("queue");
  const player = usePlayer();
  const { rooms, live } = useRoomsDirectory();
  // The live room you opened most recently, else your latest room.
  const room = live[0] ?? rooms[0] ?? null;

  const upcoming = Math.max(0, player.queue.length - player.queueIndex - 1);

  return (
    <SidePanel label="Queue and room">
      <div
        role="tablist"
        aria-label="Panel"
        className="flex gap-1 rounded-lg bg-secondary p-1"
      >
        <TabButton selected={tab === "queue"} onClick={() => setTab("queue")}>
          Queue <span className="font-normal text-muted-foreground">{upcoming}</span>
        </TabButton>
        <TabButton selected={tab === "room"} onClick={() => setTab("room")}>
          Room{" "}
          <span className="font-normal text-muted-foreground">
            {room?.members?.length ?? 0}
          </span>
        </TabButton>
      </div>

      {tab === "queue" ? <QueueTab /> : <RoomTab room={room} />}
    </SidePanel>
  );
}

function TabButton({
  selected,
  ...props
}: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        "h-8 flex-1 rounded-md text-[13px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
      {...props}
    />
  );
}

function QueueTab() {
  const player = usePlayer();
  // From the current song on; songs already played stay out of view.
  const start = Math.max(0, player.queueIndex);
  const shown = player.queue.slice(start);

  return (
    <div role="tabpanel" className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground">
          Up next · drag to reorder
        </span>
        {shown.length > 1 && (
          <button
            type="button"
            onClick={player.clearUpcoming}
            className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Clear
          </button>
        )}
      </div>
      <QueueList
        queue={shown}
        currentIndex={player.queueIndex >= 0 ? 0 : -1}
        playing={player.isPlaying}
        emptyText="Nothing queued yet. Play a song, or add songs to line them up."
        onJump={player.jump}
        onRemove={player.remove}
        onMove={player.move}
      />
    </div>
  );
}

const noSubscribe = () => () => {};

function RoomTab({ room }: { room: DirectoryRoom | null }) {
  // The link needs this site's address, which only the browser knows.
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => ""
  );

  if (!room) {
    return (
      <div
        role="tabpanel"
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center"
      >
        <p className="font-medium">No rooms yet</p>
        <p className="text-sm text-muted-foreground">
          Start a room and share the link: everyone hears the same song at
          the same time.
        </p>
        <StartRoomLink className="w-full" />
      </div>
    );
  }

  const link = `${origin}/rooms/${room.id}`;
  const members = room.members ?? [];
  const ownerId = room.summary?.ownerId;

  return (
    <div role="tabpanel" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-col gap-0.5">
          <span className="truncate font-semibold">{room.name}</span>
          <span className="text-xs text-muted-foreground">
            Everyone hears the same song at the same time.
          </span>
        </div>
        <div className="flex gap-2">
          <span className="flex h-9 min-w-0 flex-1 items-center truncate rounded-lg border px-3 text-[13px] text-muted-foreground">
            {link.replace(/^https?:\/\//, "")}
          </span>
          <ShareRoomButton url={link} label="Copy" primary />
        </div>
        <Link
          href={`/rooms/${room.id}`}
          className="flex h-9 items-center justify-center rounded-lg border text-[13px] font-medium outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Open room
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <span className="pb-1 text-xs font-medium tracking-wide text-muted-foreground">
          Listening now
        </span>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {room.members === null ? "Checking…" : "Nobody's in this room right now."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-2.5 px-2 py-1.5">
                <MemberAvatar member={member} className="size-8 border-0 text-xs" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {member.name}
                </span>
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {member.id === ownerId ? "Host" : "Listener"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
