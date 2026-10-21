import { NextResponse } from 'next/server';

import { cleanName, ROOM_NAME_MAX } from '@/lib/room';
import { createRoom } from '@/lib/rooms';

export async function POST(request: Request) {
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

  const id = createRoom(name);
  if (!id) {
    return NextResponse.json(
      { error: 'Too many rooms are open right now. Try again later.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ id }, { status: 201 });
}
