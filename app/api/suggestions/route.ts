import { songFeedResponse } from '@/lib/song-feed';
import { isVideoId } from '@/lib/song';
import { relatedSongs, suggestedSongs } from '@/lib/youtube-music';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  const seeds = (searchParams.get('seeds') ?? '').split(',').filter(isVideoId);

  // With a listening history, suggest songs like what was played;
  // otherwise fall back to the generic home feed.
  return songFeedResponse(
    cursor,
    () => (seeds.length > 0 ? relatedSongs(seeds) : suggestedSongs()),
    {
      label: 'suggestions',
      errorMessage: 'Suggestions are temporarily unavailable.',
    }
  );
}
