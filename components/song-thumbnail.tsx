"use client";

import { useState } from "react";
import { Music } from "lucide-react";

import { cn } from "@/lib/utils";

/** Pastel tiles from the design, each with a matching dark ink. */
const PALETTE = [
  { background: "#d9f99d", color: "#365314" },
  { background: "#fdba74", color: "#7c2d12" },
  { background: "#93c5fd", color: "#1e3a8a" },
  { background: "#fca5a5", color: "#7f1d1d" },
  { background: "#fcd34d", color: "#78350f" },
  { background: "#a5f3fc", color: "#164e63" },
  { background: "#d8b4fe", color: "#581c87" },
  { background: "#fda4af", color: "#881337" },
];

/** A stable palette colour for a name or id. */
export function paletteFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface SongThumbnailProps {
  src: string | null;
  /**
   * Shown as a coloured initial when there's no artwork (or it fails to
   * load). Without it, a music icon is shown instead.
   */
  label?: string;
  className?: string;
  /** Size of the fallback icon or initial. */
  iconClassName?: string;
  loading?: "lazy" | "eager";
}

export function SongThumbnail({
  src,
  label,
  className,
  iconClassName,
  loading,
}: SongThumbnailProps) {
  // Track the URL that failed rather than a boolean, so a new `src` retries.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || src === failedSrc) {
    if (label) {
      return (
        <div
          aria-hidden="true"
          style={paletteFor(label)}
          className={cn(
            "flex size-full items-center justify-center font-bold tracking-tight",
            iconClassName
          )}
        >
          {label.trim().charAt(0).toUpperCase() || "♪"}
        </div>
      );
    }
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
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn("size-full object-cover", className)}
    />
  );
}
