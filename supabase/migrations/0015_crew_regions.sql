-- Crew regions + regional leaderboard RPC.

alter table public.crews
  add column if not exists region text not null default 'vienna';

create index if not exists crews_region_idx on public.crews (region);

create or replace function public.create_my_crew(
  p_crew_name text,
  p_invite_code text,
  p_region text default 'vienna'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_invite_code(p_invite_code);
  v_region text := coalesce(nullif(trim(p_region), ''), 'vienna');
  v_crew public.crews;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_not_found';
  end if;

  if v_code = '' or length(v_code) < 4 then
    raise exception 'invalid_invite_code';
  end if;

  if exists (select 1 from public.crews where invite_code = v_code) then
    raise exception 'invite_code_taken';
  end if;

  perform public.leave_current_crew();

  insert into public.crews (name, invite_code, owner_id, region)
  values (trim(p_crew_name), v_code, auth.uid(), v_region)
  returning * into v_crew;

  insert into public.crew_members (crew_id, user_id)
  values (v_crew.id, auth.uid());

  return public.get_my_crew_snapshot();
end;
$$;

grant execute on function public.create_my_crew(text, text, text) to authenticated;

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
      'skip_pot_cents', v_crew.skip_pot_cents,
      'owner_id', v_crew.owner_id,
      'region', v_crew.region
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

create or replace function public.get_regional_crew_rankings(p_mode text default 'today')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crew_id uuid;
  v_region text;
  v_tz text := public.app_timezone();
  v_today date := public.vienna_today();
  v_mode text := lower(coalesce(p_mode, 'today'));
begin
  if auth.uid() is null then
    return '[]'::json;
  end if;

  v_crew_id := public.my_crew_id();
  if v_crew_id is null then
    return '[]'::json;
  end if;

  select c.region into v_region
  from public.crews c
  where c.id = v_crew_id;

  if v_region is null then
    return '[]'::json;
  end if;

  return coalesce((
    select json_agg(json_build_object(
      'id', ranked.id,
      'name', ranked.name,
      'member_count', ranked.member_count,
      'today', ranked.today,
      'week', ranked.week,
      'is_mine', ranked.is_mine
    ) order by
      case when v_mode = 'week' then ranked.week else ranked.today end desc,
      ranked.name)
    from (
      select
        c.id,
        c.name,
        count(distinct cm.user_id)::int as member_count,
        coalesce(sum(t.today), 0)::int as today,
        coalesce(sum(t.week), 0)::int as week,
        (c.id = v_crew_id) as is_mine
      from public.crews c
      join public.crew_members cm on cm.crew_id = c.id
      left join lateral (
        select
          coalesce(sum(pl.count) filter (
            where (pl.logged_at at time zone v_tz)::date = v_today
          ), 0)::int as today,
          coalesce(sum(pl.count) filter (
            where (pl.logged_at at time zone v_tz)::date >= v_today - 6
          ), 0)::int as week
        from public.pushup_logs pl
        where pl.user_id = cm.user_id
          and pl.crew_id = c.id
      ) t on true
      where c.region = v_region
      group by c.id, c.name
    ) ranked
  ), '[]'::json);
end;
$$;

grant execute on function public.get_regional_crew_rankings(text) to authenticated;
