-- PushupCrew initial schema.
-- Run via Supabase SQL editor, or `supabase db push` if you use the CLI.
--
-- Order: tables first, then RLS policies (policies reference crew_members).

-- ─── TABLES ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  handle text unique not null,
  daily_goal int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  skip_pot_cents int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create table if not exists public.pushup_logs (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  crew_id uuid not null references public.crews on delete cascade,
  count int not null check (count > 0),
  logged_at timestamptz not null default now()
);

create index if not exists pushup_logs_user_logged_at_idx
  on public.pushup_logs (user_id, logged_at desc);
create index if not exists pushup_logs_crew_logged_at_idx
  on public.pushup_logs (crew_id, logged_at desc);

create table if not exists public.chat_messages (
  id bigserial primary key,
  crew_id uuid not null references public.crews on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_crew_created_idx
  on public.chat_messages (crew_id, created_at desc);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.pushup_logs enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles
drop policy if exists "profiles are viewable by anyone in same crew" on public.profiles;
create policy "profiles are viewable by anyone in same crew"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.crew_members me
      join public.crew_members them on them.crew_id = me.crew_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Crews
drop policy if exists "members can read their crew" on public.crews;
create policy "members can read their crew"
  on public.crews for select
  using (
    exists (
      select 1 from public.crew_members
      where crew_id = crews.id and user_id = auth.uid()
    )
  );

-- Crew members
drop policy if exists "members can list their crew membership" on public.crew_members;
create policy "members can list their crew membership"
  on public.crew_members for select
  using (
    user_id = auth.uid()
    or crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
  );

drop policy if exists "users can join a crew" on public.crew_members;
create policy "users can join a crew"
  on public.crew_members for insert
  with check (user_id = auth.uid());

-- Pushup logs
drop policy if exists "members can read crew logs" on public.pushup_logs;
create policy "members can read crew logs"
  on public.pushup_logs for select
  using (
    crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
  );

drop policy if exists "users can insert their own logs" on public.pushup_logs;
create policy "users can insert their own logs"
  on public.pushup_logs for insert
  with check (user_id = auth.uid());

-- Chat
drop policy if exists "members can read crew messages" on public.chat_messages;
create policy "members can read crew messages"
  on public.chat_messages for select
  using (
    crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
  );

drop policy if exists "members can send messages" on public.chat_messages;
create policy "members can send messages"
  on public.chat_messages for insert
  with check (
    user_id = auth.uid()
    and crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
  );

-- ─── REALTIME (optional — enable in Dashboard if this errors on re-run) ───
do $$
begin
  alter publication supabase_realtime add table public.pushup_logs;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;

-- ─── HELPER VIEWS ────────────────────────────────────────────────────────

create or replace view public.user_daily_totals as
  select
    user_id,
    crew_id,
    (logged_at at time zone 'UTC')::date as day,
    sum(count) as count
  from public.pushup_logs
  group by user_id, crew_id, (logged_at at time zone 'UTC')::date;

create or replace view public.user_lifetime_totals as
  select user_id, crew_id, sum(count) as total
  from public.pushup_logs
  group by user_id, crew_id;
