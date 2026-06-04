-- Skip pot: €1 per member per UTC day they miss their daily goal in the crew.

create table if not exists public.crew_skip_penalties (
  id bigserial primary key,
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  amount_cents int not null default 100 check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (crew_id, user_id, day)
);

create index if not exists crew_skip_penalties_crew_day_idx
  on public.crew_skip_penalties (crew_id, day desc);

alter table public.crew_skip_penalties enable row level security;

drop policy if exists "members can read crew skip penalties" on public.crew_skip_penalties;
create policy "members can read crew skip penalties"
  on public.crew_skip_penalties for select
  using (public.is_crew_member(crew_skip_penalties.crew_id));

create or replace function public.skip_penalty_cents()
returns int
language sql
immutable
as $$
  select 100;
$$;

-- Settle skip days for one member from join date through yesterday (UTC).
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
  v_today date := (now() at time zone 'UTC')::date;
  v_day date := (p_joined_at at time zone 'UTC')::date;
  v_goal int := greatest(20, least(300, coalesce(p_daily_goal, 100)));
  v_count int;
  v_penalty int := public.skip_penalty_cents();
  v_added int := 0;
begin
  while v_day < v_today loop
    if not exists (
      select 1
      from public.crew_skip_penalties sp
      where sp.crew_id = p_crew_id
        and sp.user_id = p_user_id
        and sp.day = v_day
    ) then
      select coalesce(sum(pl.count), 0)::int
      into v_count
      from public.pushup_logs pl
      where pl.user_id = p_user_id
        and pl.crew_id = p_crew_id
        and (pl.logged_at at time zone 'UTC')::date = v_day;

      if v_count < v_goal then
        insert into public.crew_skip_penalties (crew_id, user_id, day, amount_cents)
        values (p_crew_id, p_user_id, v_day, v_penalty);

        update public.crews
        set skip_pot_cents = skip_pot_cents + v_penalty
        where id = p_crew_id;

        v_added := v_added + v_penalty;
      else
        insert into public.crew_skip_penalties (crew_id, user_id, day, amount_cents)
        values (p_crew_id, p_user_id, v_day, 0);
      end if;
    end if;

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

create or replace function public.settle_skip_days_on_member_leave()
returns trigger
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
  where p.id = OLD.user_id;

  perform public.process_crew_member_skip_days(
    OLD.crew_id,
    OLD.user_id,
    OLD.joined_at,
    v_goal
  );

  return OLD;
end;
$$;

drop trigger if exists crew_members_settle_skip_days on public.crew_members;
create trigger crew_members_settle_skip_days
  before delete on public.crew_members
  for each row
  execute function public.settle_skip_days_on_member_leave();

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
