import { connection, NextResponse } from 'next/server';

/** The server clock, so listeners can line their players up with it. */
export async function GET() {
  await connection();
  return NextResponse.json(
    { serverTime: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
