"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Song } from "@/lib/song";

interface SongPage {
  results: Song[];
  nextCursor: string | null;
}

async function fetchPage(url: string, signal?: AbortSignal): Promise<SongPage> {
  const response = await fetch(url, { signal });
  const data: Partial<SongPage> & { error?: string } = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return { results: data.results ?? [], nextCursor: data.nextCursor ?? null };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

interface FeedState {
  url: string | null;
  songs: Song[];
  nextCursor: string | null;
  error: string;
  loadingMore: boolean;
  loadMoreError: string;
}

function emptyState(url: string | null): FeedState {
  return {
    url,
    songs: [],
    nextCursor: null,
    error: "",
    loadingMore: false,
    loadMoreError: "",
  };
}

/**
 * A cursor-paginated list of songs from one of the song APIs.
 * Pass `null` to keep the feed idle. Changing `url` starts a new feed.
 */
export function useSongFeed(url: string | null) {
  const [state, setState] = useState<FeedState>(() => emptyState(null));
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!url) return;

    const controller = new AbortController();
    loadingMoreRef.current = false;

    fetchPage(url, controller.signal)
      .then((page) =>
        setState({
          ...emptyState(url),
          songs: page.results,
          nextCursor: page.nextCursor,
        })
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ ...emptyState(url), error: errorMessage(error) });
      });

    return () => controller.abort();
  }, [url]);

  // Until the first page for `url` arrives, show it as loading rather
  // than the previous feed's songs.
  const current = state.url === url ? state : emptyState(url);
  const loading = url !== null && state.url !== url;

  const loadMore = useCallback(async () => {
    if (!url || state.url !== url || !state.nextCursor) return;
    if (loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setState((prev) =>
      prev.url === url ? { ...prev, loadingMore: true, loadMoreError: "" } : prev
    );

    const endpoint = url.split("?")[0];

    try {
      const page = await fetchPage(
        `${endpoint}?cursor=${encodeURIComponent(state.nextCursor)}`
      );

      setState((prev) => {
        if (prev.url !== url) return prev;
        const known = new Set(prev.songs.map((song) => song.id));
        return {
          ...prev,
          songs: [
            ...prev.songs,
            ...page.results.filter((song) => !known.has(song.id)),
          ],
          nextCursor: page.nextCursor,
          loadingMore: false,
        };
      });
    } catch (error: unknown) {
      setState((prev) =>
        prev.url === url
          ? {
              ...prev,
              loadingMore: false,
              // Cursors are single-use, so a failed page can't be retried.
              nextCursor: null,
              loadMoreError: errorMessage(error),
            }
          : prev
      );
    } finally {
      loadingMoreRef.current = false;
    }
  }, [url, state.url, state.nextCursor]);

  return {
    songs: current.songs,
    loading,
    error: current.error,
    hasMore: current.nextCursor !== null,
    loadingMore: current.loadingMore,
    loadMoreError: current.loadMoreError,
    loadMore,
  };
}
