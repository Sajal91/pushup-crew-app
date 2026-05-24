-- Fix recursive RLS checks caused by policies that query public.crew_members
-- from inside policies that also depend on public.crew_members.

create or replace function public.is_crew_member(
  p_crew_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members cm
    where cm.crew_id = p_crew_id
      and cm.user_id = p_user_id
  );
$$;

create or replace function public.are_crew_mates(
  p_user_id uuid,
  p_other_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members me
    join public.crew_members them on them.crew_id = me.crew_id
    where me.user_id = p_user_id
      and them.user_id = p_other_user_id
  );
$$;

grant execute on function public.is_crew_member(uuid, uuid) to authenticated;
grant execute on function public.are_crew_mates(uuid, uuid) to authenticated;

drop policy if exists "profiles are viewable by anyone in same crew" on public.profiles;
create policy "profiles are viewable by anyone in same crew"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.are_crew_mates(auth.uid(), profiles.id)
  );

drop policy if exists "members can read their crew" on public.crews;
create policy "members can read their crew"
  on public.crews for select
  using (public.is_crew_member(crews.id));

drop policy if exists "members can list their crew membership" on public.crew_members;
create policy "members can list their crew membership"
  on public.crew_members for select
  using (
    user_id = auth.uid()
    or public.is_crew_member(crew_members.crew_id)
  );

drop policy if exists "members can read crew logs" on public.pushup_logs;
create policy "members can read crew logs"
  on public.pushup_logs for select
  using (public.is_crew_member(pushup_logs.crew_id));

drop policy if exists "users can insert their own logs" on public.pushup_logs;
create policy "users can insert their own logs"
  on public.pushup_logs for insert
  with check (
    user_id = auth.uid()
    and public.is_crew_member(pushup_logs.crew_id)
  );

drop policy if exists "members can read crew messages" on public.chat_messages;
create policy "members can read crew messages"
  on public.chat_messages for select
  using (public.is_crew_member(chat_messages.crew_id));

drop policy if exists "members can send messages" on public.chat_messages;
create policy "members can send messages"
  on public.chat_messages for insert
  with check (
    user_id = auth.uid()
    and public.is_crew_member(chat_messages.crew_id)
  );
