-- Personal stats (lifetime XP, streak, badges) persist across crews.
-- Crew leaderboard stats (today, week, sparkline) stay scoped to the active crew.

alter table public.profiles
  add column if not exists lifetime_pushups int not null default 0,
  add column if not exists streak_days int not null default 0;

-- Backfill lifetime totals from all push-up logs (every crew the user ever joined).
update public.profiles p
set lifetime_pushups = coalesce((
  select sum(pl.count)::int
  from public.pushup_logs pl
  where pl.user_id = p.id
), 0);

create or replace function public.compute_streak_days(
  p_user_id uuid,
  p_daily_goal int default 100
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_goal int := greatest(20, least(300, coalesce(p_daily_goal, 100)));
  v_day date := (now() at time zone 'UTC')::date;
  v_streak int := 0;
  v_count int;
begin
  select coalesce(sum(pl.count), 0)::int
  into v_count
  from public.pushup_logs pl
  where pl.user_id = p_user_id
    and (pl.logged_at at time zone 'UTC')::date = v_day;

  if v_count < v_goal then
    v_day := v_day - 1;
  end if;

  loop
    select coalesce(sum(pl.count), 0)::int
    into v_count
    from public.pushup_logs pl
    where pl.user_id = p_user_id
      and (pl.logged_at at time zone 'UTC')::date = v_day;

    exit when v_count < v_goal;

    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  return v_streak;
end;
$$;

create or replace function public.sync_personal_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal int;
begin
  select coalesce(p.daily_goal, 100)
  into v_goal
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    return;
  end if;

  update public.profiles
  set
    lifetime_pushups = coalesce((
      select sum(pl.count)::int
      from public.pushup_logs pl
      where pl.user_id = p_user_id
    ), 0),
    streak_days = public.compute_streak_days(p_user_id, v_goal)
  where id = p_user_id;
end;
$$;

create or replace function public.trigger_sync_personal_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_personal_stats(NEW.user_id);
  return NEW;
end;
$$;

drop trigger if exists pushup_logs_sync_personal_stats on public.pushup_logs;
create trigger pushup_logs_sync_personal_stats
  after insert on public.pushup_logs
  for each row
  execute function public.trigger_sync_personal_stats();

-- Backfill streak for existing users.
do $$
declare
  v_profile record;
begin
  for v_profile in select id, daily_goal from public.profiles loop
    perform public.sync_personal_stats(v_profile.id);
  end loop;
end;
$$;

create or replace function public.get_my_personal_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  return json_build_object(
    'lifetime_total', coalesce(v_profile.lifetime_pushups, 0),
    'streak', coalesce(v_profile.streak_days, 0),
    'daily_goal', coalesce(v_profile.daily_goal, 100)
  );
end;
$$;

grant execute on function public.get_my_personal_stats() to authenticated;

drop function if exists public.leave_my_crew();

create or replace function public.leave_my_crew()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if public.my_crew_id() is null then
    raise exception 'not_in_crew';
  end if;

  perform public.leave_current_crew();

  return public.get_my_personal_stats();
end;
$$;

grant execute on function public.leave_my_crew() to authenticated;

-- Crew snapshot: crew-scoped today/week/sparkline + personal lifetime stats per member.
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
        'daily_goal', coalesce(p.daily_goal, 100),
        'lifetime_total', coalesce(p.lifetime_pushups, 0),
        'streak', coalesce(p.streak_days, 0),
        'today', coalesce(t.today, 0),
        'week', coalesce(t.week, 0),
        'daily_stats', coalesce(ds.daily_stats, '[]'::json)
      ) order by coalesce(t.today, 0) desc, p.name)
      from public.crew_members cm
      join public.profiles p on p.id = cm.user_id
      left join lateral (
        select
          coalesce(sum(pl.count) filter (
            where (pl.logged_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date
          ), 0)::int as today,
          coalesce(sum(pl.count) filter (
            where (pl.logged_at at time zone 'UTC')::date >= (now() at time zone 'UTC')::date - 6
          ), 0)::int as week
        from public.pushup_logs pl
        where pl.user_id = cm.user_id and pl.crew_id = v_crew_id
      ) t on true
      left join lateral (
        select json_agg(json_build_object(
          'day', days.day,
          'count', coalesce(totals.count, 0)
        ) order by days.day) as daily_stats
        from (
          select ((now() at time zone 'UTC')::date - gs.offset_days)::date as day
          from generate_series(6, 0, -1) as gs(offset_days)
        ) days
        left join (
          select
            (pl.logged_at at time zone 'UTC')::date as day,
            sum(pl.count)::int as count
          from public.pushup_logs pl
          where pl.user_id = cm.user_id
            and pl.crew_id = v_crew_id
            and (pl.logged_at at time zone 'UTC')::date >= (now() at time zone 'UTC')::date - 6
          group by (pl.logged_at at time zone 'UTC')::date
        ) totals on totals.day = days.day
      ) ds on true
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
