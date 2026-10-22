-- "Let everyone add songs": when false, only the host can add, remove,
-- reorder or jump between songs in the queue. Existing rooms stay open.
alter table public.rooms
  add column if not exists open boolean not null default true;
