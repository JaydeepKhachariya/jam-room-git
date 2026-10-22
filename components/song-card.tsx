import { AudioLines, Check, ListPlus, Play } from "lucide-react";

import { SongThumbnail } from "@/components/song-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

interface SongCardProps {
  song: Song;
  isCurrent: boolean;
  /** What clicking the card does: play it now, or add it to a queue. */
  action?: "play" | "add";
  /** Already waiting in the queue, so adding it again does nothing. */
  queued?: boolean;
  onSelect: () => void;
}

export function SongCard({
  song,
  isCurrent,
  action = "play",
  queued = false,
  onSelect,
}: SongCardProps) {
  const artists = song.artists.join(", ");
  const inQueue = action === "add" && queued;
  const label = inQueue
    ? `${song.title} by ${artists} is already in the queue`
    : action === "add"
      ? `Add ${song.title} by ${artists} to the queue`
      : `Play ${song.title} by ${artists}`;

  return (
    <Card
      size="sm"
      className={cn(
        "group/song relative pt-0 transition-shadow hover:ring-foreground/25",
        isCurrent && "ring-2 ring-primary hover:ring-primary"
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <SongThumbnail
          src={song.thumbnail}
          loading="lazy"
          className="transition-transform duration-300 group-hover/song:scale-105"
          iconClassName="size-10"
        />

        {inQueue && (
          <Badge className="absolute top-2 left-2 shadow-md">
            {isCurrent ? <AudioLines /> : <Check />}
            {isCurrent ? "Playing" : "In queue"}
          </Badge>
        )}

        <div
          aria-hidden="true"
          className={cn(
            "absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200",
            isCurrent
              ? "opacity-100"
              : "translate-y-2 opacity-0 group-focus-within/song:translate-y-0 group-focus-within/song:opacity-100 group-hover/song:translate-y-0 group-hover/song:opacity-100"
          )}
        >
          {isCurrent ? (
            <AudioLines className="size-5" />
          ) : inQueue ? (
            <Check className="size-5" />
          ) : action === "add" ? (
            <ListPlus className="size-5" />
          ) : (
            <Play className="size-5 fill-current" />
          )}
        </div>
      </div>

      <CardHeader className="gap-0.5">
        <CardTitle className="truncate" title={song.title}>
          {song.title}
        </CardTitle>
        <CardDescription className="truncate text-xs" title={artists}>
          {artists}
        </CardDescription>
      </CardHeader>

      <button
        type="button"
        onClick={inQueue ? undefined : onSelect}
        aria-label={label}
        aria-disabled={inQueue || undefined}
        aria-current={isCurrent || undefined}
        className={cn(
          "absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          inQueue && "cursor-default"
        )}
      />
    </Card>
  );
}

export function SongCardSkeleton() {
  return (
    <Card size="sm" className="pt-0">
      <Skeleton className="aspect-square rounded-none" />
      <CardHeader className="gap-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
    </Card>
  );
}
