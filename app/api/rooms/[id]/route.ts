import { NextResponse } from 'next/server';

import { getRoomSnapshot } from '@/lib/rooms';

export async function GET(_request: Request, ctx: RouteContext<'/api/rooms/[id]'>) {
  const { id } = await ctx.params;
  const room = getRoomSnapshot(id);

  if (!room) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  }

  return NextResponse.json(room);
}
