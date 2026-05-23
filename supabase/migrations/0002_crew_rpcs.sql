-- Crew create/join RPCs + profile helpers.
-- Run after 0001_init.sql (Supabase SQL editor or `supabase db push`).

-- ─── PROFILE + CREW POLICIES (RPCs need insert access) ───────────────────
drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "authenticated users can create crews" on public.crews;
create policy "authenticated users can create crews"
  on public.crews for insert
  to authenticated
  with check (true);

-- ─── NORMALIZE INVITE CODE ───────────────────────────────────────────────
create or replace function public.normalize_invite_code(raw text)
returns text
language sql
immutable
as $$
  select upper(trim(regexp_replace(coalesce(raw, ''), '\s+', '', 'g')));
$$;

-- ─── UNIQUE HANDLE FROM USER ─────────────────────────────────────────────
create or replace function public.default_handle(p_user_id uuid)
returns text
language sql
immutable
as $$
  select '@' || left(replace(p_user_id::text, '-', ''), 10);
$$;

-- ─── UPSERT PROFILE ──────────────────────────────────────────────────────
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

grant execute on function public.upsert_my_profile(text, int) to authenticated;

-- ─── UPDATE DAILY GOAL ───────────────────────────────────────────────────
create or replace function public.update_my_daily_goal(p_daily_goal int)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set daily_goal = greatest(20, least(300, p_daily_goal))
  where id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'profile_not_found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.update_my_daily_goal(int) to authenticated;

-- ─── PREVIEW CREW BY INVITE CODE ─────────────────────────────────────────
create or replace function public.preview_crew_by_invite_code(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_invite_code(p_invite_code);
  v_crew public.crews;
  v_members json;
begin
  if v_code = '' then
    return null;
  end if;

  select * into v_crew from public.crews where invite_code = v_code;

  if v_crew.id is null then
    return null;
  end if;

  select coalesce(json_agg(json_build_object(
    'name', p.name
  ) order by cm.joined_at), '[]'::json)
  into v_members
  from public.crew_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.crew_id = v_crew.id;

  return json_build_object(
    'crew_id', v_crew.id,
    'name', v_crew.name,
    'invite_code', v_crew.invite_code,
    'member_count', json_array_length(v_members),
    'members', v_members
  );
end;
$$;

grant execute on function public.preview_crew_by_invite_code(text) to authenticated;

-- ─── MY CREW ID ──────────────────────────────────────────────────────────
create or replace function public.my_crew_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.crew_id
  from public.crew_members cm
  where cm.user_id = auth.uid()
  limit 1;
$$;

-- ─── ENSURE NOT ALREADY IN A CREW ────────────────────────────────────────
create or replace function public.assert_not_in_crew()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.my_crew_id() is not null then
    raise exception 'already_in_crew';
  end if;
end;
$$;

-- ─── CREATE CREW ─────────────────────────────────────────────────────────
create or replace function public.create_my_crew(
  p_crew_name text,
  p_invite_code text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_invite_code(p_invite_code);
  v_crew public.crews;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_not_found';
  end if;

  perform public.assert_not_in_crew();

  if v_code = '' or length(v_code) < 4 then
    raise exception 'invalid_invite_code';
  end if;

  if exists (select 1 from public.crews where invite_code = v_code) then
    raise exception 'invite_code_taken';
  end if;

  insert into public.crews (name, invite_code)
  values (trim(p_crew_name), v_code)
  returning * into v_crew;

  insert into public.crew_members (crew_id, user_id)
  values (v_crew.id, auth.uid());

  return public.get_my_crew_snapshot();
end;
$$;

grant execute on function public.create_my_crew(text, text) to authenticated;

-- ─── JOIN CREW ───────────────────────────────────────────────────────────
create or replace function public.join_crew_by_invite_code(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_invite_code(p_invite_code);
  v_crew_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_not_found';
  end if;

  perform public.assert_not_in_crew();

  select id into v_crew_id from public.crews where invite_code = v_code;

  if v_crew_id is null then
    raise exception 'crew_not_found';
  end if;

  insert into public.crew_members (crew_id, user_id)
  values (v_crew_id, auth.uid());

  return public.get_my_crew_snapshot();
end;
$$;

grant execute on function public.join_crew_by_invite_code(text) to authenticated;

-- ─── CREW SNAPSHOT (members + stats + chat) ──────────────────────────────
create or replace function public.get_my_crew_snapshot()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew_id uuid;
  v_crew public.crews;
  v_profile public.profiles;
  v_result json;
begin
  if auth.uid() is null then
    return null;
  end if;

  v_crew_id := public.my_crew_id();

  if v_crew_id is null then
    return null;
  end if;

  select * into v_crew from public.crews where id = v_crew_id;
  select * into v_profile from public.profiles where id = auth.uid();

  select json_build_object(
    'crew', json_build_object(
      'id', v_crew.id,
      'name', v_crew.name,
      'invite_code', v_crew.invite_code,
      'skip_pot_cents', v_crew.skip_pot_cents
    ),
    'daily_goal', coalesce(v_profile.daily_goal, 100),
    'members', coalesce((
      select json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'handle', p.handle,
        'today', coalesce(t.today, 0),
        'week', coalesce(t.week, 0),
        'total', coalesce(t.total, 0)
      ) order by coalesce(t.today, 0) desc, p.name)
      from public.crew_members cm
      join public.profiles p on p.id = cm.user_id
      left join lateral (
        select
          coalesce(sum(pl.count) filter (
            where (pl.logged_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date
          ), 0)::int as today,
          coalesce(sum(pl.count) filter (
            where pl.logged_at >= (now() at time zone 'UTC') - interval '7 days'
          ), 0)::int as week,
          coalesce(sum(pl.count), 0)::int as total
        from public.pushup_logs pl
        where pl.user_id = cm.user_id and pl.crew_id = v_crew_id
      ) t on true
      where cm.crew_id = v_crew_id
    ), '[]'::json),
    'chat', coalesce((
      select json_agg(json_build_object(
        'id', ch.id,
        'user_id', ch.user_id,
        'text', ch.text,
        'created_at', ch.created_at
      ) order by ch.created_at asc)
      from (
        select *
        from public.chat_messages
        where crew_id = v_crew_id
        order by created_at desc
        limit 80
      ) ch
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_my_crew_snapshot() to authenticated;
