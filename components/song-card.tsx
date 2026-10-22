import { Check, ListPlus, Pause, Play, Plus } from "lucide-react";

import { SongThumbnail } from "@/components/song-thumbnail";
import { Skeleton } from "@/components/ui/skeleton";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

interface SongCardProps {
  song: Song;
  isCurrent: boolean;
  /** The current song and it's playing: the button pauses it. */
  playing?: boolean;
  /** What clicking the card does: play it now, or add it to a queue. */
  action?: "play" | "add";
  /** Already waiting in the queue, so adding it again does nothing. */
  queued?: boolean;
  /** Adding isn't allowed (a host-only room): only the badges show. */
  readOnly?: boolean;
  onSelect: () => void;
  /** Shows a secondary button that adds the song to the queue. */
  onAddToQueue?: () => void;
}

export function SongCard({
  song,
  isCurrent,
  playing = false,
  action = "play",
  queued = false,
  readOnly = false,
  onSelect,
  onAddToQueue,
}: SongCardProps) {
  const artists = song.artists.join(", ");
  const isAdd = action === "add";
  const done = isAdd && (queued || isCurrent);
  const disabled = done || (isAdd && readOnly);
  const label = isAdd
    ? done
      ? `${song.title} by ${artists} is ${isCurrent ? "playing" : "already in the queue"}`
      : `Add ${song.title} by ${artists} to the queue`
    : `${isCurrent && playing ? "Pause" : "Play"} ${song.title} by ${artists}`;
  const badge = isAdd ? (isCurrent ? "Playing" : queued ? "In queue" : null) : null;

  return (
    <div
      className={cn(
        "group/song relative flex min-w-0 flex-col gap-3 rounded-xl border p-3 transition-colors",
        isCurrent
          ? "border-zinc-600 bg-secondary"
          : "border-border bg-card hover:bg-secondary/60"
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        <SongThumbnail
          src={song.thumbnail}
          label={song.title}
          loading="lazy"
          iconClassName="text-[2.75rem]"
        />

        {badge && (
          <span
            className={cn(
              "absolute top-2 left-2 inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium shadow-md",
              isCurrent
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-foreground"
            )}
          >
            {badge}
          </span>
        )}

        {!(isAdd && readOnly && !done) && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-2 bottom-2 flex items-center justify-center rounded-full shadow-lg transition-transform group-hover/song:scale-105",
              isAdd ? "size-9" : "size-10",
              done
                ? "border border-zinc-700 bg-background text-foreground"
                : "bg-primary text-primary-foreground"
            )}
          >
            {done ? (
              <Check className="size-4" />
            ) : isAdd ? (
              <Plus className="size-4" />
            ) : isCurrent && playing ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium" title={song.title}>
          {song.title}
        </span>
        <span className="truncate text-xs text-muted-foreground" title={artists}>
          {artists}
        </span>
      </div>

      <button
        type="button"
        onClick={disabled ? undefined : onSelect}
        aria-label={label}
        aria-disabled={disabled || undefined}
        aria-current={isCurrent || undefined}
        className={cn(
          "absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          disabled && "cursor-default"
        )}
      />

      {onAddToQueue && (
        <button
          type="button"
          onClick={onAddToQueue}
          aria-label={`Add ${song.title} by ${artists} to the queue`}
          title="Add to queue"
          className="absolute top-5 right-5 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md outline-none backdrop-blur transition-opacity duration-200 hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 pointer-fine:opacity-0 pointer-fine:group-focus-within/song:opacity-100 pointer-fine:group-hover/song:opacity-100"
        >
          <ListPlus className="size-4" />
        </button>
      )}
    </div>
  );
}

export function SongCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <Skeleton className="aspect-square rounded-lg" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
