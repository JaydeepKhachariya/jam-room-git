"use client";

import { useState } from "react";
import { Music } from "lucide-react";

import { cn } from "@/lib/utils";

interface SongThumbnailProps {
  src: string | null;
  className?: string;
  iconClassName?: string;
  loading?: "lazy" | "eager";
}

/**
 * Song artwork with a music-icon fallback, shown both when the song has no
 * thumbnail and when the thumbnail URL fails to load.
 */
export function SongThumbnail({
  src,
  className,
  iconClassName,
  loading,
}: SongThumbnailProps) {
  // Track the URL that failed rather than a boolean, so a new `src` retries.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || src === failedSrc) {
    return (
      <div className="flex size-full items-center justify-center">
        <Music className={cn("text-muted-foreground", iconClassName)} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading={loading}
      onError={() => setFailedSrc(src)}
      className={cn("size-full object-cover", className)}
    />
  );
}
