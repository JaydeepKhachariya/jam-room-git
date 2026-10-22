# Jam Rooms

Search for songs and play them, or start a room and listen together:
everyone in a room hears the same song at the same moment and shares
one queue.

## Setup

Rooms are stored in [Supabase](https://supabase.com), so they work
across the many server instances Vercel runs.

1. Create a Supabase project.
2. In the SQL editor, run
   [`supabase/migrations/20261022000000_rooms.sql`](supabase/migrations/20261022000000_rooms.sql).
3. Under **Realtime → Settings**, make sure public channels are allowed
   (public access on, not "private channels only"). Rooms use public
   Broadcast and Presence channels named `room:<id>`.
4. Copy `.env.example` to `.env.local` and fill in the project URL,
   publishable key and secret key (**Project Settings → API Keys**).
   Add the same three variables to the Vercel project.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5342](http://localhost:5342).

## How rooms stay in sync

- API routes are the only thing that writes to the `rooms` table, using
  the secret key; the table has row level security on and no policies.
  Each change is applied only if the room's `version` hasn't moved
  since it was read, so concurrent changes retry instead of clobbering
  each other.
- After a change, the new room state is broadcast on the room's Realtime
  channel. Browsers subscribe with the publishable key, and also use
  Presence there to show who's listening.
- Playback is stored as "at `position` seconds at server time
  `updatedAt`". Each browser estimates the server's clock (`/api/time`)
  and nudges its player whenever it drifts more than 0.35s.
