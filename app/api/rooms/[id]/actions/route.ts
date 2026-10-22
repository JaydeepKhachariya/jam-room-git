import { NextResponse } from 'next/server';

import { parseRoomAction } from '@/lib/room';
import {
  clientToken,
  handleRoomErrors,
  missingClient,
  roomResponse,
} from '@/lib/room-request';
import { applyRoomAction } from '@/lib/rooms';

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/rooms/[id]/actions'>
) {
  const { id } = await ctx.params;
  const token = clientToken(request);
  if (!token) return missingClient();

  const action = parseRoomAction(await request.json().catch(() => null));
  if (!action) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  return handleRoomErrors(action.type, async () =>
    roomResponse(await applyRoomAction(id, token, action))
  );
}
