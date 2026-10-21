import { AudioLines, ListMusic, X } from "lucide-react";

import { SongThumbnail } from "@/components/song-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { QueuedSong } from "@/lib/room";
import { cn } from "@/lib/utils";

interface RoomQueueProps {
  queue: QueuedSong[];
  currentIndex: number;
  playing: boolean;
  onJump: (queueId: string) => void;
  onRemove: (queueId: string) => void;
  className?: string;
}

export function RoomQueue({
  queue,
  currentIndex,
  playing,
  onJump,
  onRemove,
  className,
}: RoomQueueProps) {
  return (
    <Card size="sm" className={cn("min-h-0", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListMusic className="size-4" />
          Queue
        </CardTitle>
        <CardDescription>
          {queue.length === 0
            ? "Shared with everyone in the room."
            : `${queue.length} ${queue.length === 1 ? "song" : "songs"}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 overflow-y-auto">
        {queue.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing queued yet. Pick a song to add it here.
          </p>
        ) : (
          <ol className="flex flex-col gap-0.5">
            {queue.map((song, index) => {
              const isCurrent = index === currentIndex;
              const artists = song.artists.join(", ");

              return (
                <Item
                  key={song.queueId}
                  render={<li />}
                  size="xs"
                  variant={isCurrent ? "muted" : "default"}
                  className={cn(
                    "relative flex-nowrap hover:bg-muted/50",
                    index < currentIndex && "opacity-60"
                  )}
                >
                  <ItemMedia variant="image" className="relative bg-muted">
                    <SongThumbnail src={song.thumbnail} iconClassName="size-4" />
                    {isCurrent && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                        <AudioLines
                          className={cn("size-4", playing && "animate-pulse")}
                        />
                      </div>
                    )}
                  </ItemMedia>

                  <ItemContent className="min-w-0">
                    <ItemTitle className="block w-full truncate">
                      {song.title}
                    </ItemTitle>
                    <ItemDescription className="truncate">
                      {artists} · added by {song.addedBy}
                    </ItemDescription>
                  </ItemContent>

                  <button
                    type="button"
                    onClick={() => onJump(song.queueId)}
                    aria-label={`Play ${song.title} by ${artists}`}
                    aria-current={isCurrent || undefined}
                    className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  />

                  <ItemActions className="relative">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${song.title} from the queue`}
                      onClick={() => onRemove(song.queueId)}
                    >
                      <X />
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
