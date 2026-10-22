import { X } from "lucide-react";

import { LivePill, MemberAvatar } from "@/components/rooms/room-cards";
import { Spinner } from "@/components/ui/spinner";
import type { RoomMember } from "@/lib/room";

interface RoomMembersProps {
  members: RoomMember[];
  ownerId: string;
  you: string;
  connected: boolean;
  onRemove: (member: RoomMember) => void;
}

/** Who's listening, with remove buttons for the host. */
export function RoomMembers({
  members,
  ownerId,
  you,
  connected,
  onRemove,
}: RoomMembersProps) {
  if (!connected) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Spinner className="size-3.5" />
        Connecting…
      </p>
    );
  }

  const isHost = you === ownerId;
  // Host first, then you, then everyone else in join order (members
  // arrive sorted by when they joined).
  const sorted = [...members].sort(
    (a, b) =>
      Number(b.id === ownerId) - Number(a.id === ownerId) ||
      Number(b.id === you) - Number(a.id === you)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <LivePill className="h-6 px-2.5 text-xs">
        {members.length} listening
      </LivePill>

      <ul className="contents">
        {sorted.map((member) => {
          const role =
            member.id === ownerId
              ? member.id === you
                ? "Host (you)"
                : "Host"
              : member.id === you
                ? "(you)"
                : null;
          return (
            <li
              key={member.id}
              className="flex h-7 items-center gap-2 rounded-full border py-0.5 pr-2.5 pl-1 text-xs font-medium"
            >
              <MemberAvatar
                member={member}
                className="size-5 border-0 text-[10px]"
              />
              <span className="max-w-32 truncate">{member.name}</span>
              {role && (
                <span className="font-normal text-muted-foreground">{role}</span>
              )}
              {isHost && member.id !== you && (
                <button
                  type="button"
                  aria-label={`Remove ${member.name} from the room`}
                  onClick={() => onRemove(member)}
                  className="-mr-1 flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
