"use client";

import { useState } from "react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { SongThumbnail } from "@/components/song-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import type { PlayerStatus } from "@/hooks/use-youtube-player";
import type { Song } from "@/lib/song";
import { cn } from "@/lib/utils";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

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
}: PlayerBarProps) {
  // While the seek bar is dragged, show where it's going and seek once
  // on release, rather than on every step of the drag.
  const [dragTime, setDragTime] = useState<number | null>(null);
  const shownTime = dragTime ?? currentTime;

  const seekProps = {
    "aria-label": "Seek",
    min: 0,
    max: Math.max(duration, 1),
    step: 1,
    // An array: the Slider renders one thumb per value.
    value: [Math.min(shownTime, duration)],
    disabled: !duration,
    onValueChange: (value: number | readonly number[]) =>
      setDragTime(sliderNumber(value)),
    onValueCommitted: (value: number | readonly number[]) => {
      setDragTime(null);
      onSeek(sliderNumber(value));
    },
  };

  const isPlaying = status === "playing";
  const isLoading = status === "loading";

  return (
    <div
      data-player-bar
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
    >
      {resumePending && (
        <div className="pointer-events-none absolute inset-x-0 -top-11 flex justify-center px-4">
          <Badge
            variant="secondary"
            className="h-7 gap-1.5 px-3 shadow-md"
            role="status"
          >
            <Play data-icon="inline-start" />
            Click anywhere to resume from {formatTime(currentTime)}
          </Badge>
        </div>
      )}
      <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 sm:items-end sm:self-end">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            <SongThumbnail src={song.thumbnail} iconClassName="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{song.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {song.artists.join(", ")}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 sm:order-none">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous"
              onClick={onPrevious}
              disabled={!hasPrevious && currentTime < 3}
            >
              <SkipBack />
            </Button>
            <Button
              size="icon"
              className={cn(
                "rounded-full",
                resumePending && "animate-pulse ring-3 ring-primary/40"
              )}
              aria-label={
                isPlaying || isLoading ? "Pause" : resumePending ? "Resume" : "Play"
              }
              onClick={onTogglePlay}
            >
              {isLoading ? <Spinner /> : isPlaying ? <Pause /> : <Play />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next"
              onClick={onNext}
              disabled={!hasNext}
            >
              <SkipForward />
            </Button>
          </div>
          <div className="hidden h-4 w-full items-center gap-2 sm:flex">
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
              {formatTime(shownTime)}
            </span>
            <Slider {...seekProps} />
            <span className="w-10 text-xs text-muted-foreground tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="hidden h-4 items-center justify-end gap-2 self-end sm:flex">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={onToggleMute}
          >
            {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
          </Button>
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

        <div className="col-span-2 flex items-center gap-2 sm:hidden">
          <Slider {...seekProps} />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatTime(shownTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
