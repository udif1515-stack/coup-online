create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[0-9]{6}$'),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  host_player_id uuid null,
  game_state_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players
  add column if not exists room_id uuid;

-- Existing global-lobby players cannot be safely assigned to a room.
-- Run this during deployment downtime, before players use the new room-code flow.
delete from public.players
where room_id is null;

alter table public.players
  alter column room_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_room_id_fkey'
      and conrelid = 'public.players'::regclass
  ) then
    alter table public.players
      add constraint players_room_id_fkey
      foreign key (room_id)
      references public.rooms(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rooms_host_player_id_fkey'
      and conrelid = 'public.rooms'::regclass
  ) then
    alter table public.rooms
      add constraint rooms_host_player_id_fkey
      foreign key (host_player_id)
      references public.players(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists players_room_seat_index_key
  on public.players(room_id, seat_index);

create index if not exists players_room_id_idx
  on public.players(room_id);

create index if not exists rooms_updated_at_idx
  on public.rooms(updated_at);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'rooms'
    ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'players'
    ) then
    alter publication supabase_realtime add table public.players;
  end if;
end $$;
