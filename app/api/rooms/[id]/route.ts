import {
  clientToken,
  handleRoomErrors,
  missingClient,
  roomResponse,
} from '@/lib/room-request';
import { getRoom } from '@/lib/rooms';

export async function GET(request: Request, ctx: RouteContext<'/api/rooms/[id]'>) {
  const { id } = await ctx.params;
  const token = clientToken(request);
  if (!token) return missingClient();

  return handleRoomErrors('get', async () => roomResponse(await getRoom(id, token)));
}
