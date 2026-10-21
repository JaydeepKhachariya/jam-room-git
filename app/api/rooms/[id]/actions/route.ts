import { NextResponse } from 'next/server';

import { parseRoomAction } from '@/lib/room';
import { applyRoomAction } from '@/lib/rooms';

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/rooms/[id]/actions'>
) {
  const { id } = await ctx.params;
  const action = parseRoomAction(await request.json().catch(() => null));

  if (!action) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  const room = applyRoomAction(id, action);
  if (!room) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  }

  return NextResponse.json(room);
}
