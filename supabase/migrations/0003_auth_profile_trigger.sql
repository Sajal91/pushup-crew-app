-- Auto-create public.profiles when a new auth user signs up (fixes profiles_id_fkey).
-- Run after 0001_init.sql and 0002_crew_rpcs.sql.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'given_name'), ''),
    'BRO'
  );

  insert into public.profiles (id, name, handle, daily_goal)
  values (
    new.id,
    v_name,
    public.default_handle(new.id),
    100
  )
  on conflict (id) do update
  set name = excluded.name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this trigger existed.
insert into public.profiles (id, name, handle, daily_goal)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    'BRO'
  ),
  public.default_handle(u.id),
  100
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- Safer upsert: only write after auth.users row exists.
create or replace function public.upsert_my_profile(
  p_name text,
  p_daily_goal int default 100
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from auth.users where id = v_uid) then
    raise exception 'auth_user_not_ready';
  end if;

  insert into public.profiles (id, name, handle, daily_goal)
  values (
    v_uid,
    trim(p_name),
    public.default_handle(v_uid),
    greatest(20, least(300, coalesce(p_daily_goal, 100)))
  )
  on conflict (id) do update
  set
    name = excluded.name,
    daily_goal = excluded.daily_goal
  returning * into v_row;

  return v_row;
end;
$$;
