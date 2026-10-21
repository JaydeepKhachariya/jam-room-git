import { NextResponse } from 'next/server';

import { cleanName, MEMBER_NAME_MAX } from '@/lib/room';
import { getRoomSnapshot, subscribeToRoom } from '@/lib/rooms';

// Comment lines keep proxies from closing an idle stream.
const HEARTBEAT_MS = 15_000;

/** Server-Sent Events stream of room snapshots, one per change. */
export async function GET(
  request: Request,
  ctx: RouteContext<'/api/rooms/[id]/events'>
) {
  const { id } = await ctx.params;
  const name =
    cleanName(new URL(request.url).searchParams.get('name'), MEMBER_NAME_MAX) ??
    'Guest';

  if (!getRoomSnapshot(id)) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      function write(chunk: string) {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      }

      const unsubscribe = subscribeToRoom(id, name, (room) =>
        write(`data: ${JSON.stringify(room)}\n\n`)
      );
      const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };

      // Joining broadcasts the new member list, which also sends this
      // listener the current state.
      if (!unsubscribe) cleanup();

      request.signal.addEventListener('abort', () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      // no-transform stops compression from buffering the stream.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
