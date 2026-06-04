-- Leave crew + allow join/create while already in a crew (auto-leaves current crew).

create or replace function public.leave_current_crew()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.crew_members where user_id = auth.uid();
end;
$$;

create or replace function public.leave_my_crew()
returns void
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
end;
$$;

grant execute on function public.leave_my_crew() to authenticated;

-- ─── CREATE CREW (can switch away from current crew) ─────────────────────
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

  if v_code = '' or length(v_code) < 4 then
    raise exception 'invalid_invite_code';
  end if;

  if exists (select 1 from public.crews where invite_code = v_code) then
    raise exception 'invite_code_taken';
  end if;

  perform public.leave_current_crew();

  insert into public.crews (name, invite_code)
  values (trim(p_crew_name), v_code)
  returning * into v_crew;

  insert into public.crew_members (crew_id, user_id)
  values (v_crew.id, auth.uid());

  return public.get_my_crew_snapshot();
end;
$$;

-- ─── JOIN CREW (can switch away from current crew) ───────────────────────
create or replace function public.join_crew_by_invite_code(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_invite_code(p_invite_code);
  v_crew_id uuid;
  v_current uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile_not_found';
  end if;

  select id into v_crew_id from public.crews where invite_code = v_code;

  if v_crew_id is null then
    raise exception 'crew_not_found';
  end if;

  v_current := public.my_crew_id();

  if v_current = v_crew_id then
    raise exception 'same_crew';
  end if;

  if v_current is not null then
    perform public.leave_current_crew();
  end if;

  insert into public.crew_members (crew_id, user_id)
  values (v_crew_id, auth.uid());

  return public.get_my_crew_snapshot();
end;
$$;
