"use client";

import { useEffect, useRef } from "react";

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  disabled?: boolean;
  /** Start loading this far before the trigger scrolls into view. */
  rootMargin?: string;
  /**
   * Changes whenever new items render. Re-observing then re-checks
   * visibility, so a short page that leaves the trigger on screen
   * keeps loading until it fills the viewport.
   */
  itemCount: number;
}

export function InfiniteScrollTrigger({
  onLoadMore,
  disabled = false,
  rootMargin = "600px",
  itemCount,
}: InfiniteScrollTriggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [disabled, rootMargin, itemCount]);

  return <div ref={ref} aria-hidden="true" className="h-px w-full" />;
}
