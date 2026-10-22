import { NextResponse } from 'next/server';

import { CLIENT_HEADER, isClientToken } from '@/lib/room';
import type { RoomResult } from '@/lib/rooms';

/** The caller's client token, from the header or the `client` param. */
export function clientToken(request: Request) {
  const token =
    request.headers.get(CLIENT_HEADER) ??
    new URL(request.url).searchParams.get('client');
  return isClientToken(token) ? token : null;
}

export const missingClient = () =>
  NextResponse.json({ error: 'Missing client id.' }, { status: 400 });

export function roomResponse(result: RoomResult) {
  return result.ok
    ? NextResponse.json(result.room)
    : NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      );
}

/** Runs a room handler, reporting storage failures as JSON errors. */
export async function handleRoomErrors(
  label: string,
  handler: () => Promise<Response>
) {
  try {
    return await handler();
  } catch (error) {
    console.error(`[rooms] ${label} failed:`, error);
    return NextResponse.json(
      { error: 'Rooms are temporarily unavailable. Try again shortly.' },
      { status: 503 }
    );
  }
}
