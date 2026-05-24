-- Include each member's daily goal in crew snapshots so leaderboard progress can
-- compare today's pushups against that member's own target.

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
