import { NextResponse } from 'next/server';

import { isVideoId } from '@/lib/song';
import { radioSongs } from '@/lib/youtube-music';

/** Songs like the one given, for filling a queue with the same vibe. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';

  if (!isVideoId(id)) {
    return NextResponse.json({ error: 'Invalid song.' }, { status: 400 });
  }

  try {
    return NextResponse.json({ results: await radioSongs(id) });
  } catch (error: unknown) {
    console.error('YouTube Music radio failed:', error);
    return NextResponse.json(
      { error: 'Related songs are temporarily unavailable.' },
      { status: 502 }
    );
  }
}
