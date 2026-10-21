import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import type { Song } from '@/lib/song';

export const PAGE_SIZE = 24;

const CURSOR_TTL_MS = 15 * 60 * 1000;
const MAX_CURSORS = 500;

interface FeedState {
  source: AsyncGenerator<Song[]>;
  buffer: Song[];
  expiresAt: number;
}

/**
 * YouTube continuations are stateful objects, so open feeds are kept in
 * memory and addressed by an opaque, single-use cursor. This works for a
 * single long-running server (`next dev` / `next start`); on serverless
 * hosts a cursor may land on another instance and come back as expired.
 */
const globalStore = globalThis as typeof globalThis & {
  __songFeedCursors?: Map<string, FeedState>;
};
const cursors = (globalStore.__songFeedCursors ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [cursor, state] of cursors) {
    if (state.expiresAt <= now) {
      cursors.delete(cursor);
      void state.source.return(undefined);
    }
  }

  // Oldest entries first (Map keeps insertion order).
  while (cursors.size > MAX_CURSORS) {
    const [cursor, state] = cursors.entries().next().value!;
    cursors.delete(cursor);
    void state.source.return(undefined);
  }
}

async function readPage(state: Omit<FeedState, 'expiresAt'>) {
  let done = false;

  while (state.buffer.length < PAGE_SIZE) {
    const next = await state.source.next();
    if (next.done) {
      done = true;
      break;
    }
    state.buffer.push(...next.value);
  }

  const results = state.buffer.splice(0, PAGE_SIZE);
  let nextCursor: string | null = null;

  if (!done || state.buffer.length > 0) {
    sweep();
    nextCursor = randomUUID();
    cursors.set(nextCursor, {
      source: state.source,
      buffer: state.buffer,
      expiresAt: Date.now() + CURSOR_TTL_MS,
    });
  }

  return { results, nextCursor };
}

/**
 * Respond with one page of songs: the first page of a new feed, or the
 * next page for `cursor`. Response: `{ results, nextCursor }`.
 */
export async function songFeedResponse(
  cursor: string | null,
  createSource: () => AsyncGenerator<Song[]>,
  { label, errorMessage }: { label: string; errorMessage: string }
) {
  let state: Omit<FeedState, 'expiresAt'>;

  if (cursor) {
    const stored = cursors.get(cursor);
    // Single-use: a cursor is consumed by the request that reads it.
    cursors.delete(cursor);

    if (!stored || stored.expiresAt <= Date.now()) {
      return NextResponse.json(
        { error: 'This list expired. Refresh to load it again.' },
        { status: 410 }
      );
    }

    state = stored;
  } else {
    state = { source: createSource(), buffer: [] };
  }

  try {
    return NextResponse.json(await readPage(state));
  } catch (error: unknown) {
    console.error(`YouTube Music ${label} failed:`, error);

    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
