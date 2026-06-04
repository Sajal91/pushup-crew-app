-- Skip pot uses Europe/Vienna (Austria) calendar days.
-- At each new Vienna day, every crew is checked: €1 per member who missed their goal yesterday.
-- pg_cron runs hourly and settles yesterday once (idempotent).

create or replace function public.app_timezone()
returns text
language sql
immutable
as $$
  select 'Europe/Vienna';
$$;

create or replace function public.vienna_today()
returns date
language sql
stable
as $$
  select (now() at time zone public.app_timezone())::date;
$$;

create or replace function public.vienna_yesterday()
returns date
language sql
stable
as $$
  select public.vienna_today() - 1;
$$;

create table if not exists public.skip_pot_run_log (
  vienna_day date primary key,
  processed_at timestamptz not null default now()
);

-- Process a single member for one Vienna calendar day.
create or replace function public.process_crew_member_skip_day(
  p_crew_id uuid,
  p_user_id uuid,
  p_day date,
  p_daily_goal int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal int := greatest(20, least(300, coalesce(p_daily_goal, 100)));
  v_count int;
  v_penalty int := public.skip_penalty_cents();
begin
  if exists (
    select 1
    from public.crew_skip_penalties sp
    where sp.crew_id = p_crew_id
      and sp.user_id = p_user_id
      and sp.day = p_day
  ) then
    return 0;
  end if;

  select coalesce(sum(pl.count), 0)::int
  into v_count
  from public.pushup_logs pl
  where pl.user_id = p_user_id
    and pl.crew_id = p_crew_id
    and (pl.logged_at at time zone public.app_timezone())::date = p_day;

  if v_count < v_goal then
    insert into public.crew_skip_penalties (crew_id, user_id, day, amount_cents)
    values (p_crew_id, p_user_id, p_day, v_penalty);

    update public.crews
    set skip_pot_cents = skip_pot_cents + v_penalty
    where id = p_crew_id;

    return v_penalty;
  end if;

  insert into public.crew_skip_penalties (crew_id, user_id, day, amount_cents)
  values (p_crew_id, p_user_id, p_day, 0);

  return 0;
end;
$$;

-- All members in one crew for one Vienna day (e.g. 3 misses → +€3).
create or replace function public.process_crew_skip_for_day(
  p_crew_id uuid,
  p_day date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_added int := 0;
begin
  for v_member in
    select
      cm.user_id,
      coalesce(p.daily_goal, 100) as daily_goal
    from public.crew_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.crew_id = p_crew_id
      and (cm.joined_at at time zone public.app_timezone())::date <= p_day
  loop
    v_added := v_added + public.process_crew_member_skip_day(
      p_crew_id,
      v_member.user_id,
      p_day,
      v_member.daily_goal
    );
  end loop;

  return v_added;
end;
$$;

-- Every crew, one Vienna day.
create or replace function public.process_all_crews_skip_for_day(p_day date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew record;
  v_added int := 0;
begin
  for v_crew in select c.id from public.crews c loop
    v_added := v_added + public.process_crew_skip_for_day(v_crew.id, p_day);
  end loop;

  return v_added;
end;
$$;

-- Catch-up from join date through yesterday (Vienna) for one member.
create or replace function public.process_crew_member_skip_days(
  p_crew_id uuid,
  p_user_id uuid,
  p_joined_at timestamptz,
  p_daily_goal int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.vienna_today();
  v_day date := (p_joined_at at time zone public.app_timezone())::date;
  v_added int := 0;
begin
  while v_day < v_today loop
    v_added := v_added + public.process_crew_member_skip_day(
      p_crew_id,
      p_user_id,
      v_day,
      p_daily_goal
    );
    v_day := v_day + 1;
  end loop;

  return v_added;
end;
$$;

create or replace function public.process_crew_skip_penalties(p_crew_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_added int := 0;
begin
  for v_member in
    select
      cm.user_id,
      cm.joined_at,
      coalesce(p.daily_goal, 100) as daily_goal
    from public.crew_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.crew_id = p_crew_id
  loop
    v_added := v_added + public.process_crew_member_skip_days(
      p_crew_id,
      v_member.user_id,
      v_member.joined_at,
      v_member.daily_goal
    );
  end loop;

  return v_added;
end;
$$;

-- Called by pg_cron (and app sync fallback). Settles yesterday for all crews once per Vienna day.
create or replace function public.run_daily_skip_penalties_vienna()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yesterday date := public.vienna_yesterday();
  v_added int := 0;
begin
  if exists (
    select 1
    from public.skip_pot_run_log
    where vienna_day = v_yesterday
  ) then
    return 0;
  end if;

  v_added := public.process_all_crews_skip_for_day(v_yesterday);

  insert into public.skip_pot_run_log (vienna_day)
  values (v_yesterday)
  on conflict (vienna_day) do nothing;

  return v_added;
end;
$$;

-- pg_cron: check every hour; first run after Vienna midnight settles yesterday for all crews.
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron cron schema missing — enable Cron under Supabase Dashboard → Integrations';
    return;
  end if;

  select j.jobid
  into v_job_id
  from cron.job j
  where j.jobname = 'skip-pot-vienna-daily';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'skip-pot-vienna-daily',
    '10 * * * *',
    $cron$select public.run_daily_skip_penalties_vienna();$cron$
  );
exception
  when undefined_table then
    raise notice 'pg_cron not available — enable Cron in Supabase Dashboard → Integrations';
  when insufficient_privilege then
    raise notice 'Could not schedule skip-pot-vienna-daily — add it manually in Supabase Cron';
end;
$$;

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
  v_tz text := public.app_timezone();
  v_today date := public.vienna_today();
  v_result json;
begin
  if auth.uid() is null then
    return null;
  end if;

  v_crew_id := public.my_crew_id();

  if v_crew_id is null then
    return null;
  end if;

  perform public.run_daily_skip_penalties_vienna();
  perform public.process_crew_skip_penalties(v_crew_id);

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
        'skip_days', coalesce(sk.skip_days, 0),
        'today', coalesce(t.today, 0),
        'week', coalesce(t.week, 0),
        'daily_stats', coalesce(ds.daily_stats, '[]'::json)
      ) order by coalesce(t.today, 0) desc, p.name)
      from public.crew_members cm
      join public.profiles p on p.id = cm.user_id
      left join lateral (
        select count(*)::int as skip_days
        from public.crew_skip_penalties sp
        where sp.crew_id = v_crew_id
          and sp.user_id = cm.user_id
          and sp.amount_cents > 0
      ) sk on true
      left join lateral (
        select
          coalesce(sum(pl.count) filter (
            where (pl.logged_at at time zone v_tz)::date = v_today
          ), 0)::int as today,
          coalesce(sum(pl.count) filter (
            where (pl.logged_at at time zone v_tz)::date >= v_today - 6
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
          select (v_today - gs.offset_days)::date as day
          from generate_series(6, 0, -1) as gs(offset_days)
        ) days
        left join (
          select
            (pl.logged_at at time zone v_tz)::date as day,
            sum(pl.count)::int as count
          from public.pushup_logs pl
          where pl.user_id = cm.user_id
            and pl.crew_id = v_crew_id
            and (pl.logged_at at time zone v_tz)::date >= v_today - 6
          group by (pl.logged_at at time zone v_tz)::date
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

-- Align personal streak calculation with Austria calendar days.
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
  v_day date := public.vienna_today();
  v_streak int := 0;
  v_count int;
begin
  select coalesce(sum(pl.count), 0)::int
  into v_count
  from public.pushup_logs pl
  where pl.user_id = p_user_id
    and (pl.logged_at at time zone public.app_timezone())::date = v_day;

  if v_count < v_goal then
    v_day := v_day - 1;
  end if;

  loop
    select coalesce(sum(pl.count), 0)::int
    into v_count
    from public.pushup_logs pl
    where pl.user_id = p_user_id
      and (pl.logged_at at time zone public.app_timezone())::date = v_day;

    exit when v_count < v_goal;

    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  return v_streak;
end;
$$;

do $$
declare
  v_profile record;
begin
  for v_profile in select id from public.profiles loop
    perform public.sync_personal_stats(v_profile.id);
  end loop;
end;
$$;
