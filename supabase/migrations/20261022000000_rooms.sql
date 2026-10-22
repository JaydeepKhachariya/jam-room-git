-- Shared listening rooms. Only the app's API routes (using the secret
-- key) read and write this table: RLS is on with no policies, so the
-- publishable key used in browsers can't touch it. Browsers get live
-- updates from Realtime Broadcast on the channel `room:<id>` instead.

create table if not exists public.rooms (
  id text primary key,
  name text not null check (char_length(name) between 1 and 60),
  -- Hash of the creator's client token; never the token itself.
  owner_id text not null,
  -- [{ id, title, artists, thumbnail, queueId, addedBy }, ...]
  queue jsonb not null default '[]'::jsonb,
  -- { index, playing, position, updatedAt }
  playback jsonb not null,
  -- Playback ran off the end of the queue; the next song added starts.
  finished boolean not null default false,
  -- Member ids the host removed.
  banned text[] not null default '{}',
  -- Bumped on every change; updates are conditional on it, so
  -- concurrent changes from different server instances can't clobber
  -- each other.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

alter table public.rooms enable row level security;
