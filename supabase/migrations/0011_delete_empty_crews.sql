-- Delete crews automatically when the last member leaves.
-- Push-up logs are kept (crew_id set to null) so personal lifetime stats stay intact.

alter table public.pushup_logs
  alter column crew_id drop not null;

alter table public.pushup_logs
  drop constraint if exists pushup_logs_crew_id_fkey;

alter table public.pushup_logs
  add constraint pushup_logs_crew_id_fkey
  foreign key (crew_id) references public.crews (id) on delete set null;

drop policy if exists "members can read crew logs" on public.pushup_logs;
create policy "members can read crew logs"
  on public.pushup_logs for select
  using (
    public.is_crew_member(pushup_logs.crew_id)
    or (pushup_logs.crew_id is null and pushup_logs.user_id = auth.uid())
  );

create or replace function public.delete_crew_if_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.crew_members cm
    where cm.crew_id = OLD.crew_id
  ) then
    delete from public.crews where id = OLD.crew_id;
  end if;

  return OLD;
end;
$$;

drop trigger if exists crew_members_delete_empty_crew on public.crew_members;
create trigger crew_members_delete_empty_crew
  after delete on public.crew_members
  for each row
  execute function public.delete_crew_if_empty();

-- Remove any crews that already have zero members.
delete from public.crews c
where not exists (
  select 1
  from public.crew_members cm
  where cm.crew_id = c.id
);
