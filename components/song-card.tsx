import { AudioLines, Play } from "lucide-react";

import { SongThumbnail } from "@/components/song-thumbnail";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

interface SongCardProps {
  song: Song;
  isCurrent: boolean;
  onPlay: () => void;
}

export function SongCard({ song, isCurrent, onPlay }: SongCardProps) {
  const artists = song.artists.join(", ");

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
        onClick={onPlay}
        aria-label={`Play ${song.title} by ${artists}`}
        aria-current={isCurrent || undefined}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
