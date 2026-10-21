import { NextResponse } from 'next/server';

import { songFeedResponse } from '@/lib/song-feed';
import { searchSongs } from '@/lib/youtube-music';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  const query = (searchParams.get('q') ?? '').trim();

  if (!cursor && (!query || query.length > 200)) {
    return NextResponse.json(
      { error: 'Enter a search query up to 200 characters.' },
      { status: 400 }
    );
  }

  return songFeedResponse(cursor, () => searchSongs(query), {
    label: 'search',
    errorMessage: 'Search is temporarily unavailable.',
  });
}
