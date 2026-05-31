-- Optional: profile columns if you later add server-sent push (Expo Push + Edge Function).
-- Daily goal reminders are scheduled locally in the app at 18:00 GMT+2 — no Supabase cron required.

alter table public.profiles
  add column if not exists expo_push_token text,
  add column if not exists push_notifications_enabled boolean not null default true;
