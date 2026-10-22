import { NextResponse } from 'next/server';

import { cleanName, ROOM_NAME_MAX } from '@/lib/room';
import { clientToken, handleRoomErrors, missingClient } from '@/lib/room-request';
import { createRoom } from '@/lib/rooms';

export async function POST(request: Request) {
  const token = clientToken(request);
  if (!token) return missingClient();

  const body: unknown = await request.json().catch(() => null);
  const name = cleanName(
    (body as { name?: unknown } | null)?.name,
    ROOM_NAME_MAX
  );

  if (!name) {
    return NextResponse.json(
      { error: `Enter a room name up to ${ROOM_NAME_MAX} characters.` },
      { status: 400 }
    );
  }

  return handleRoomErrors('create', async () =>
    NextResponse.json({ id: await createRoom(name, token) }, { status: 201 })
  );
}
