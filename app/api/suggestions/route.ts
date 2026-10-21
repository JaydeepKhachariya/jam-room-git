import { songFeedResponse } from '@/lib/song-feed';
import { suggestedSongs } from '@/lib/youtube-music';

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get('cursor');

  return songFeedResponse(cursor, suggestedSongs, {
    label: 'suggestions',
    errorMessage: 'Suggestions are temporarily unavailable.',
  });
}
