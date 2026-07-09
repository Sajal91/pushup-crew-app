-- Remote push notifications via Expo Push API + push-dispatch Edge Function.
--
-- After applying this migration:
--   1. Deploy: supabase functions deploy push-dispatch
--   2. Set Edge Function secret PUSH_WEBHOOK_SECRET to the value from:
--        select webhook_secret from private.push_settings;
--   3. Set functions URL (once per project):
--        update private.push_settings
--        set functions_url = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1';

-- ─── Profile push token RPCs ───────────────────────────────────────────────

create or replace function public.update_my_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.profiles
  set expo_push_token = nullif(trim(p_token), '')
  where id = auth.uid();
end;
$$;

create or replace function public.clear_my_push_token()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
  set expo_push_token = null
  where id = auth.uid();
end;
$$;

grant execute on function public.update_my_push_token(text) to authenticated;
grant execute on function public.clear_my_push_token() to authenticated;

-- ─── Edge function dispatch helper ─────────────────────────────────────────

create schema if not exists private;

create table if not exists private.push_settings (
  id int primary key default 1 check (id = 1),
  webhook_secret text not null,
  functions_url text not null default ''
);

insert into private.push_settings (webhook_secret)
select encode(gen_random_bytes(32), 'hex')
where not exists (select 1 from private.push_settings where id = 1);

create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_push_dispatch(p_body jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select functions_url, webhook_secret
  into v_url, v_secret
  from private.push_settings
  where id = 1;

  if coalesce(v_url, '') = '' then
    raise notice 'push-dispatch skipped: set private.push_settings.functions_url';
    return null;
  end if;

  select net.http_post(
    url := v_url || '/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := p_body
  )
  into v_request_id;

  return v_request_id;
end;
$$;

-- ─── Realtime event triggers ───────────────────────────────────────────────

create or replace function private.trigger_push_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.invoke_push_dispatch(jsonb_build_object(
    'event', 'chat_message',
    'record', jsonb_build_object(
      'crew_id', NEW.crew_id,
      'user_id', NEW.user_id,
      'text', NEW.text
    )
  ));
  return NEW;
end;
$$;

drop trigger if exists push_on_chat_message on public.chat_messages;
create trigger push_on_chat_message
  after insert on public.chat_messages
  for each row
  execute function private.trigger_push_on_chat_message();

create or replace function private.trigger_push_on_pushup_log()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.invoke_push_dispatch(jsonb_build_object(
    'event', 'pushup_log',
    'record', jsonb_build_object(
      'crew_id', NEW.crew_id,
      'user_id', NEW.user_id,
      'count', NEW.count
    )
  ));
  return NEW;
end;
$$;

drop trigger if exists push_on_pushup_log on public.pushup_logs;
create trigger push_on_pushup_log
  after insert on public.pushup_logs
  for each row
  execute function private.trigger_push_on_pushup_log();

create or replace function private.trigger_push_on_crew_pot_update()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if NEW.skip_pot_cents is distinct from OLD.skip_pot_cents then
    perform private.invoke_push_dispatch(jsonb_build_object(
      'event', 'crew_pot_update',
      'record', jsonb_build_object(
        'id', NEW.id,
        'skip_pot_cents', NEW.skip_pot_cents
      ),
      'old_record', jsonb_build_object(
        'skip_pot_cents', OLD.skip_pot_cents
      )
    ));
  end if;
  return NEW;
end;
$$;

drop trigger if exists push_on_crew_pot_update on public.crews;
create trigger push_on_crew_pot_update
  after update of skip_pot_cents on public.crews
  for each row
  execute function private.trigger_push_on_crew_pot_update();

-- ─── Scheduled push jobs (pg_cron) ─────────────────────────────────────────
-- daily_goal: 18:00 fixed GMT+2 = 16:00 UTC
-- flame_extinguisher + morning_ledger: checked inside Edge Function (Europe/Vienna)

create or replace function private.invoke_scheduled_push(p_job text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.invoke_push_dispatch(jsonb_build_object(
    'event', 'scheduled',
    'job', p_job
  ));
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron missing — enable Cron under Supabase Dashboard → Integrations';
    return;
  end if;

  -- Daily goal reminder at 16:00 UTC (18:00 GMT+2)
  select j.jobid into v_job_id from cron.job j where j.jobname = 'push-daily-goal';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'push-daily-goal',
    '0 16 * * *',
    $cron$select private.invoke_scheduled_push('daily_goal');$cron$
  );

  -- Flame extinguisher — hourly, Edge Function gates to 19:00 Vienna
  select j.jobid into v_job_id from cron.job j where j.jobname = 'push-flame-extinguisher';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'push-flame-extinguisher',
    '0 * * * *',
    $cron$select private.invoke_scheduled_push('flame_extinguisher');$cron$
  );

  -- Morning ledger — hourly at :30, Edge Function gates to 07:30 Vienna
  select j.jobid into v_job_id from cron.job j where j.jobname = 'push-morning-ledger';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'push-morning-ledger',
    '30 * * * *',
    $cron$select private.invoke_scheduled_push('morning_ledger');$cron$
  );
exception
  when undefined_table then
    raise notice 'pg_cron not available — schedule push jobs manually in Supabase Cron';
  when insufficient_privilege then
    raise notice 'Could not schedule push cron jobs — add them manually in Supabase Cron';
end;
$$;
