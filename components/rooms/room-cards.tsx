"use client";

import Link from "next/link";
import { X } from "lucide-react";

import type { DirectoryRoom } from "@/components/shell/rooms-directory";
import { paletteFor, SongThumbnail } from "@/components/song-thumbnail";
import { timeAgo } from "@/lib/format";
import type { RoomMember } from "@/lib/room";
import { cn } from "@/lib/utils";

/** The room's artwork: what's playing, or a colour from its name. */
export function RoomSwatch({
  room,
  className,
}: {
  room: DirectoryRoom;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 overflow-hidden rounded-lg",
        className
      )}
    >
      <SongThumbnail
        src={room.summary?.current?.thumbnail ?? null}
        label={room.name}
        iconClassName="text-base"
      />
    </span>
  );
}

export function LivePill({
  children = "Live",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-live-surface px-2 text-[11px] font-medium text-live-foreground",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-live" />
      {children}
    </span>
  );
}

export function MemberAvatar({
  member,
  className,
}: {
  member: Pick<RoomMember, "id" | "name">;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={paletteFor(member.id)}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold uppercase",
        className
      )}
    >
      {member.name.trim().charAt(0) || "?"}
    </span>
  );
}

export function MemberStack({ members }: { members: RoomMember[] }) {
  const shown = members.slice(0, 4);
  return (
    <span className="flex">
      {shown.map((member) => (
        <MemberAvatar key={member.id} member={member} className="-mr-1.5" />
      ))}
    </span>
  );
}

/** "4 listening", or when it was last opened here. */
export function roomStatus(room: DirectoryRoom) {
  const count = room.members?.length ?? 0;
  if (count > 0) return `${count} listening`;
  return `Last opened ${timeAgo(room.lastVisited)}`;
}

/** A room card with who's in it and a Join button. */
export function RoomCard({
  room,
  onForget,
}: {
  room: DirectoryRoom;
  onForget?: () => void;
}) {
  const live = (room.members?.length ?? 0) > 0;
  const track = room.summary?.current?.title;

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <RoomSwatch room={room} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">{room.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {track ?? "Nothing playing"}
          </span>
        </span>
        {live && <LivePill />}
        {onForget && (
          <button
            type="button"
            aria-label={`Remove ${room.name} from your rooms`}
            title="Remove from your rooms"
            onClick={onForget}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        {live && room.members ? <MemberStack members={room.members} /> : <span />}
        <span className="text-xs text-muted-foreground">{roomStatus(room)}</span>
        <Link
          href={`/rooms/${room.id}`}
          className="inline-flex h-8 items-center rounded-lg border px-3 text-[13px] font-medium outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {live ? "Join" : "Open"}
        </Link>
      </div>
    </div>
  );
}
