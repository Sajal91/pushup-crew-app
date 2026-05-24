-- Returning vs new user detection (by email / profile setup state).
-- Run after 0003_auth_profile_trigger.sql.

alter table public.profiles
  add column if not exists name_setup_complete boolean not null default false;

-- Mark existing users who already have a crew as having completed name setup.
update public.profiles p
set name_setup_complete = true
where name_setup_complete = false
  and exists (
    select 1 from public.crew_members cm where cm.user_id = p.id
  );

-- Account snapshot for post-sign-in routing.
create or replace function public.get_my_account_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_profile public.profiles;
  v_has_crew boolean;
  v_name_setup_complete boolean;
  v_is_returning boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_profile from public.profiles where id = v_uid;

  select exists (
    select 1 from public.crew_members cm where cm.user_id = v_uid
  ) into v_has_crew;

  v_name_setup_complete := coalesce(v_profile.name_setup_complete, false);

  -- Returning = this email already finished name setup or joined a crew before.
  v_is_returning := v_name_setup_complete or v_has_crew;

  return json_build_object(
    'email', v_email,
    'is_returning_user', v_is_returning,
    'is_new_user', not v_is_returning,
    'name_setup_complete', v_name_setup_complete,
    'has_crew', v_has_crew,
    'name', coalesce(v_profile.name, 'BRO'),
    'daily_goal', coalesce(v_profile.daily_goal, 100)
  );
end;
$$;

grant execute on function public.get_my_account_status() to authenticated;

-- Save display name and mark setup complete (new users only need this once).
create or replace function public.confirm_my_profile_name(
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

  insert into public.profiles (id, name, handle, daily_goal, name_setup_complete)
  values (
    v_uid,
    trim(p_name),
    public.default_handle(v_uid),
    greatest(20, least(300, coalesce(p_daily_goal, 100))),
    true
  )
  on conflict (id) do update
  set
    name = excluded.name,
    daily_goal = excluded.daily_goal,
    name_setup_complete = true
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.confirm_my_profile_name(text, int) to authenticated;
