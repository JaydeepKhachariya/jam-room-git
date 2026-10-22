import { Crown, Headphones, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <Badge className="h-7 gap-1.5 px-3 text-sm">
        <Headphones />
        {members.length} listening
      </Badge>

      <ul className="contents">
        {sorted.map((member) => (
          <li
            key={member.id}
            className="flex h-7 items-center gap-1.5 rounded-full border bg-background py-0.5 pr-1 pl-0.5 text-sm"
          >
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase"
            >
              {member.name.charAt(0)}
            </span>
            <span className="max-w-32 truncate">{member.name}</span>
            {member.id === ownerId && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Crown className="size-3" />
                Host
              </span>
            )}
            {member.id === you && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
            {isHost && member.id !== you ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={`Remove ${member.name} from the room`}
                onClick={() => onRemove(member)}
              >
                <X />
              </Button>
            ) : (
              <span className="w-1" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
