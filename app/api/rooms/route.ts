import { NextResponse } from 'next/server';

import { cleanName, ROOM_NAME_MAX } from '@/lib/room';
import { clientToken, handleRoomErrors, missingClient } from '@/lib/room-request';
import {
  createRoom,
  getRoomSummaries,
  HostOnlyUnavailableError,
} from '@/lib/rooms';

export async function POST(request: Request) {
  const token = clientToken(request);
  if (!token) return missingClient();

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    open?: unknown;
  } | null;
  const name = cleanName(body?.name, ROOM_NAME_MAX);

  if (!name) {
    return NextResponse.json(
      { error: `Enter a room name up to ${ROOM_NAME_MAX} characters.` },
      { status: 400 }
    );
  }

  return handleRoomErrors('create', async () => {
    try {
      const id = await createRoom(name, token, body?.open !== false);
      return NextResponse.json({ id }, { status: 201 });
    } catch (error) {
      if (error instanceof HostOnlyUnavailableError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      throw error;
    }
  });
}

/** Summaries of the rooms in `?ids=a,b,c`, for "Your rooms". */
export async function GET(request: Request) {
  const token = clientToken(request);
  if (!token) return missingClient();

  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .filter((id) => /^[\w-]{1,64}$/.test(id));

  return handleRoomErrors('summaries', async () =>
    NextResponse.json({ rooms: await getRoomSummaries(ids, token) })
  );
}
