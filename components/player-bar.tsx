"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { SongThumbnail } from "@/components/song-thumbnail";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import type { PlayerStatus } from "@/hooks/use-youtube-player";
import { formatTime } from "@/lib/format";
import type { RepeatMode } from "@/lib/playback-session";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

function sliderNumber(value: number | readonly number[]) {
  return typeof value === "number" ? value : value[0];
}

interface PlayerBarProps {
  song: Song;
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  /** Playback was restored but the browser blocked it from starting. */
  resumePending?: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  /** The extras below only show when their handler is given. */
  liked?: boolean;
  onToggleLike?: () => void;
  shuffle?: boolean;
  onToggleShuffle?: () => void;
  repeat?: RepeatMode;
  onCycleRepeat?: () => void;
  /** Opens the queue on screens too narrow for the side panel. */
  onOpenQueue?: () => void;
  /** Where the artwork and title link to, for the song's details. */
  detailsHref?: string;
}

function IconButton({
  className,
  active,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
        active &&
          "text-foreground after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-foreground",
        className
      )}
      {...props}
    />
  );
}

/** The artwork and title; a link to the song's details when given one. */
function NowPlayingInfo({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  const className = "flex min-w-0 flex-1 items-center gap-3";
  if (!href) return <span className={className}>{children}</span>;

  return (
    <Link
      href={href}
      title="Open now playing"
      className={cn(
        className,
        "group rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      {children}
    </Link>
  );
}

export function PlayerBar({
  song,
  status,
  currentTime,
  duration,
  volume,
  muted,
  resumePending = false,
  hasPrevious,
  hasNext,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  liked = false,
  onToggleLike,
  shuffle = false,
  onToggleShuffle,
  repeat = "off",
  onCycleRepeat,
  onOpenQueue,
  detailsHref,
}: PlayerBarProps) {
  // While the seek bar is dragged, show where it's going and seek once
  // on release, rather than on every step of the drag.
  const [dragTime, setDragTime] = useState<number | null>(null);
  const shownTime = dragTime ?? currentTime;
  const knownDuration = duration || song.duration || 0;

  const seekProps = {
    "aria-label": "Seek",
    min: 0,
    max: Math.max(knownDuration, 1),
    step: 1,
    // An array: the Slider renders one thumb per value.
    value: [Math.min(shownTime, knownDuration)],
    disabled: !knownDuration,
    onValueChange: (value: number | readonly number[]) =>
      setDragTime(sliderNumber(value)),
    onValueCommitted: (value: number | readonly number[]) => {
      setDragTime(null);
      onSeek(sliderNumber(value));
    },
  };

  const isPlaying = status === "playing";
  const isLoading = status === "loading";
  const artists = song.artists.join(", ");

  return (
    <div
      data-player-bar
      className="relative border-t bg-background px-4 py-3 sm:px-6"
    >
      {resumePending && (
        <div className="pointer-events-none absolute inset-x-0 -top-11 flex justify-center px-4">
          <span
            role="status"
            className="flex h-7 items-center gap-1.5 rounded-full border bg-secondary px-3 text-xs font-medium shadow-lg"
          >
            <Play className="size-3 fill-current" />
            Click anywhere to resume from {formatTime(currentTime)}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Now playing */}
        <div className="flex min-w-0 flex-[1_1_14rem] items-center gap-3">
          <NowPlayingInfo href={detailsHref}>
            <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              <SongThumbnail
                src={song.thumbnail}
                label={song.title}
                iconClassName="text-xl"
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  "truncate font-medium",
                  detailsHref && "group-hover:underline"
                )}
              >
                {song.title}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {artists}
              </span>
            </span>
          </NowPlayingInfo>
          {onToggleLike && (
            <IconButton
              aria-label={liked ? "Remove from Library" : "Save to Library"}
              aria-pressed={liked}
              onClick={onToggleLike}
              className={cn(liked && "text-foreground")}
            >
              <Heart className={cn("size-4", liked && "fill-current")} />
            </IconButton>
          )}
          {onOpenQueue && (
            <IconButton
              aria-label="Open queue"
              onClick={onOpenQueue}
              className="xl:hidden"
            >
              <ListMusic className="size-4" />
            </IconButton>
          )}
        </div>

        {/* Controls */}
        <div className="flex w-full flex-col items-center gap-1.5 sm:max-w-xl sm:flex-[2_1_26rem]">
          <div className="flex items-center gap-2">
            {onToggleShuffle && (
              <IconButton
                aria-label="Shuffle"
                aria-pressed={shuffle}
                active={shuffle}
                onClick={onToggleShuffle}
              >
                <Shuffle className="size-4" />
              </IconButton>
            )}
            <IconButton
              aria-label="Previous"
              onClick={onPrevious}
              disabled={!hasPrevious && currentTime < 3}
              className="text-foreground"
            >
              <SkipBack className="size-[18px] fill-current" />
            </IconButton>
            <button
              type="button"
              aria-label={
                isPlaying || isLoading ? "Pause" : resumePending ? "Resume" : "Play"
              }
              onClick={onTogglePlay}
              className={cn(
                "flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50",
                resumePending && "animate-pulse ring-3 ring-primary/40"
              )}
            >
              {isLoading ? (
                <Spinner className="size-[18px]" />
              ) : isPlaying ? (
                <Pause className="size-[18px] fill-current" />
              ) : (
                <Play className="size-[18px] translate-x-px fill-current" />
              )}
            </button>
            <IconButton
              aria-label="Next"
              onClick={onNext}
              disabled={!hasNext}
              className="text-foreground"
            >
              <SkipForward className="size-[18px] fill-current" />
            </IconButton>
            {onCycleRepeat && (
              <IconButton
                aria-label={
                  repeat === "one"
                    ? "Repeat: this song"
                    : repeat === "all"
                      ? "Repeat: queue"
                      : "Repeat: off"
                }
                active={repeat !== "off"}
                onClick={onCycleRepeat}
              >
                {repeat === "one" ? (
                  <Repeat1 className="size-4" />
                ) : (
                  <Repeat className="size-4" />
                )}
              </IconButton>
            )}
          </div>
          <div className="flex w-full items-center gap-2.5">
            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
              {formatTime(shownTime)}
            </span>
            <Slider {...seekProps} />
            <span className="w-9 text-xs text-muted-foreground tabular-nums">
              {formatTime(knownDuration)}
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="hidden flex-[1_1_14rem] items-center justify-end gap-2 md:flex">
          <IconButton
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={onToggleMute}
          >
            {muted || volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </IconButton>
          <Slider
            aria-label="Volume"
            className="max-w-28"
            min={0}
            max={100}
            step={1}
            value={[muted ? 0 : volume]}
            onValueChange={(value) => onVolumeChange(sliderNumber(value))}
          />
        </div>
      </div>
    </div>
  );
}
