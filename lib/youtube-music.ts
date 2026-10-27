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
  /** Up-next (radio) items carry the video ID here instead. */
  video_id?: string;
  /** A string, or a text node (up-next items). */
  title?: { toString(): string } | string;
  item_type?: string;
  artists?: { name: string }[];
  // Video-type items (common in playlists) list artists here instead.
  authors?: { name: string }[];
  thumbnails?: ThumbnailLike[];
  /** Up-next items name their artwork `thumbnail`. */
  thumbnail?: unknown;
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
    const id = item.id ?? item.video_id;
    if (!id || seen.has(id)) continue;
    if (item.item_type && !PLAYABLE_TYPES.has(item.item_type)) continue;
    seen.add(id);

    songs.push({
      id,
      title: item.title?.toString() || 'Unknown title',
      artists: (item.artists ?? item.authors ?? []).map(
        (artist) => artist.name
      ),
      thumbnail: largeThumbnail(
        item.thumbnails ??
          (Array.isArray(item.thumbnail)
            ? (item.thumbnail as ThumbnailLike[])
            : undefined)
      ),
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

const NOISE_WORDS = [
  'live',
  'cover',
  'remix',
  'karaoke',
  'slowed',
  'reverb',
  'sped up',
  '8d',
  'instrumental',
];

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * How well a result matches what was typed: whole-title and prefix
 * matches, how many of the words appear in the title or artists, and a
 * penalty for live/cover/remix versions nobody asked for. YouTube's own
 * order is kept as a small tiebreaker.
 */
export function relevance(
  query: string,
  song: Song,
  rank: number,
  penalty = 0
) {
  const q = normalize(query);
  const title = normalize(song.title);
  const artists = normalize(song.artists.join(' '));
  const haystack = `${title} ${artists}`.trim();
  const words = q.split(' ').filter(Boolean);
  if (words.length === 0) return 0;

  const haystackWords = haystack.split(' ');
  const covered = words.filter((word) =>
    haystackWords.some((candidate) => candidate.startsWith(word))
  ).length;

  let score = (covered / words.length) * 3;
  if (covered === words.length) score += 1;
  if (title === q) score += 3;
  else if (title.startsWith(q)) score += 1.5;
  if (haystack.includes(q)) score += 1.5;

  for (const noise of NOISE_WORDS) {
    const pattern = new RegExp(`\\b${noise}\\b`);
    if (pattern.test(title) && !pattern.test(q)) score -= 1;
  }

  // Long titles that merely contain the words are usually uploads.
  const extraWords = Math.max(0, title.split(' ').length - words.length);
  score -= Math.min(1.5, extraWords * 0.15);

  return score + 2 / (1 + rank) - penalty;
}

interface Candidate {
  song: Song;
  /** Position in its own result list. */
  rank: number;
  /** Ranks a weaker source (plain videos) below real songs. */
  penalty: number;
}

function candidates(songs: Song[], penalty = 0): Candidate[] {
  return songs.map((song, rank) => ({ song, rank, penalty }));
}

function rerank(query: string, list: Candidate[]) {
  return list
    .map(({ song, rank, penalty }) => ({
      song,
      score: relevance(query, song, rank, penalty),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ song }) => song);
}

/**
 * Search results, one YouTube page at a time. The first page blends the
 * song and video searches (so live versions and uploads that only exist
 * as videos can still surface), then ranks them by relevance.
 */
export async function* searchSongs(query: string): AsyncGenerator<Song[]> {
  const youtube = await getYouTube();
  const seen = new Set<string>();

  const [first, videos] = await Promise.all([
    youtube.music.search(query, { type: 'song' }),
    youtube.music.search(query, { type: 'video' }).catch((): null => null),
  ]);

  const songResults = toSongs(first.songs?.contents ?? [], seen);
  const videoResults = toSongs(listItems(videos?.videos?.contents ?? []), seen);
  // Videos only fill in what the song search lacks, so they rank lower.
  yield rerank(query, [
    ...candidates(songResults),
    ...candidates(videoResults.slice(0, 4), 2),
  ]);

  let page: YTMusic.Search | SearchContinuation = first;

  for (let i = 0; i < MAX_SEARCH_PAGES && page.has_continuation; i++) {
    page = await page.getContinuation();
    yield rerank(
      query,
      candidates(toSongs(listItems(page.contents?.contents ?? []), seen))
    );
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

const MAX_SEEDS = 5;

/** Songs that sound like `videoId` (YouTube Music's radio for it). */
export async function radioSongs(videoId: string): Promise<Song[]> {
  const youtube = await getYouTube();
  const upNext = await youtube.music.getUpNext(videoId);

  return toSongs((upNext.contents ?? []) as SongLike[], new Set([videoId]));
}

/**
 * Songs related to what someone has been playing: the radio of each
 * seed, interleaved so every seed gets a say, without the seeds
 * themselves. Seeds that fail are skipped.
 */
export async function* relatedSongs(
  seedIds: string[]
): AsyncGenerator<Song[]> {
  const seeds = seedIds.slice(0, MAX_SEEDS);
  const seen = new Set(seeds);

  const radios = await Promise.all(
    seeds.map((seed) =>
      radioSongs(seed).catch((error: unknown) => {
        console.error(`Radio for ${seed} failed:`, error);
        return [] as Song[];
      })
    )
  );

  const merged: Song[] = [];
  const versions = new Set<string>();
  for (let i = 0; radios.some((radio) => i < radio.length); i++) {
    for (const radio of radios) {
      const song = radio[i];
      // The same track often appears under several video IDs.
      const version = normalize(`${song.title} ${song.artists.join(' ')}`);
      if (song && !seen.has(song.id) && !versions.has(version)) {
        seen.add(song.id);
        versions.add(version);
        merged.push(song);
      }
    }
  }

  yield merged;
}
