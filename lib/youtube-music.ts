import { Innertube, YTNodes, type Helpers, type YTMusic } from 'youtubei.js';

import type { Song } from '@/lib/song';

const THUMBNAIL_SIZE = 544;
const MAX_SEARCH_PAGES = 15;
const MAX_SUGGESTION_PLAYLISTS = 10;

let youtubePromise: ReturnType<typeof Innertube.create> | undefined;

export function getYouTube() {
  if (!youtubePromise) {
    youtubePromise = Innertube.create().catch((error: unknown) => {
      youtubePromise = undefined;
      throw error;
    });
  }

  return youtubePromise;
}

interface ThumbnailLike {
  url: string;
}

interface SongLike {
  id?: string;
  title?: string;
  item_type?: string;
  artists?: { name: string }[];
  // Video-type items (common in playlists) list artists here instead.
  authors?: { name: string }[];
  thumbnails?: ThumbnailLike[];
  duration?: { seconds?: number };
}

/**
 * YouTube Music returns thumbnails largest-first, capped at 120px.
 * Their googleusercontent URLs accept a size suffix (`=w120-h120-...`),
 * so request a larger square for card artwork. Other URL shapes are
 * returned unchanged.
 */
function largeThumbnail(thumbnails: ThumbnailLike[] | undefined) {
  const url = thumbnails?.[0]?.url;
  if (!url) return null;

  return url.replace(
    /=w\d+-h\d+/,
    `=w${THUMBNAIL_SIZE}-h${THUMBNAIL_SIZE}`
  );
}

const PLAYABLE_TYPES = new Set(['song', 'video']);

/**
 * Map YouTube Music items to songs, skipping non-playable items and
 * anything already in `seen` (shared across pages to avoid repeats).
 */
export function toSongs(
  items: SongLike[],
  seen: Set<string> = new Set()
): Song[] {
  const songs: Song[] = [];

  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    if (item.item_type && !PLAYABLE_TYPES.has(item.item_type)) continue;
    seen.add(item.id);

    songs.push({
      id: item.id,
      title: item.title ?? 'Unknown title',
      artists: (item.artists ?? item.authors ?? []).map(
        (artist) => artist.name
      ),
      thumbnail: largeThumbnail(item.thumbnails),
      ...(item.duration?.seconds ? { duration: item.duration.seconds } : {}),
    });
  }

  return songs;
}

function listItems(nodes: readonly Helpers.YTNode[]) {
  return nodes.filter((node): node is YTNodes.MusicResponsiveListItem =>
    node.is(YTNodes.MusicResponsiveListItem)
  );
}

/** Search results, one YouTube page at a time. */
export async function* searchSongs(query: string): AsyncGenerator<Song[]> {
  const youtube = await getYouTube();
  const seen = new Set<string>();

  const first = await youtube.music.search(query, { type: 'song' });
  yield toSongs(first.songs?.contents ?? [], seen);

  let page: YTMusic.Search | SearchContinuation = first;

  for (let i = 0; i < MAX_SEARCH_PAGES && page.has_continuation; i++) {
    page = await page.getContinuation();
    yield toSongs(listItems(page.contents?.contents ?? []), seen);
  }
}

type SearchContinuation = Awaited<
  ReturnType<YTMusic.Search['getContinuation']>
>;

/**
 * Suggestions: songs from the home feed, then from further home feed
 * pages, then from the playlists the home feed recommends.
 */
export async function* suggestedSongs(): AsyncGenerator<Song[]> {
  const youtube = await getYouTube();
  const seen = new Set<string>();
  const playlistIds: string[] = [];

  type HomeFeed = Awaited<ReturnType<typeof youtube.music.getHomeFeed>>;

  function collect(feed: HomeFeed) {
    const items = (feed.sections ?? []).flatMap((section) =>
      'contents' in section ? section.contents : []
    );

    for (const item of items) {
      if (
        item.is(YTNodes.MusicTwoRowItem) &&
        item.item_type === 'playlist' &&
        item.id
      ) {
        playlistIds.push(item.id);
      }
    }

    return toSongs(listItems(items), seen);
  }

  let feed = await youtube.music.getHomeFeed();
  yield collect(feed);

  while (feed.has_continuation) {
    feed = await feed.getContinuation();
    yield collect(feed);
  }

  for (const id of playlistIds.slice(0, MAX_SUGGESTION_PLAYLISTS)) {
    try {
      const playlist = await youtube.music.getPlaylist(id);
      yield toSongs(listItems(playlist.items ?? []), seen);
    } catch (error: unknown) {
      // One unavailable playlist shouldn't end the feed.
      console.error(`Suggestion playlist ${id} failed:`, error);
    }
  }
}
