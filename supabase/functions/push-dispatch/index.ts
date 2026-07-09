import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendExpoPush, type PushPayload } from '../_shared/expoPush.ts';
import {
  chatMessagePayload,
  dailyGoalReminderPayload,
  dominoEffectPayload,
  flameExtinguisherPayload,
  gmt2IsoDay,
  isLoneWolfWindow,
  leaderboardThreatPayload,
  loneWolfPayload,
  milestoneFeastPayload,
  morningLedgerPayload,
  pickSlackerPayload,
  viennaIsoDay,
  viennaParts,
  viennaYesterdayIso,
} from '../_shared/notifications.ts';

const POT_MILESTONE_CENTS = 50 * 100;
const APP_TIMEZONE = 'Europe/Vienna';

type DbProfile = {
  id: string;
  name: string;
  daily_goal: number;
  streak_days: number;
  expo_push_token: string | null;
  push_notifications_enabled: boolean;
};

type CrewMemberRow = {
  user_id: string;
  name: string;
  daily_goal: number;
  streak_days: number;
  today: number;
  week: number;
  expo_push_token: string | null;
  push_notifications_enabled: boolean;
};

type DispatchBody =
  | { event: 'chat_message'; record: { crew_id: string; user_id: string; text: string } }
  | { event: 'pushup_log'; record: { crew_id: string; user_id: string; count: number } }
  | {
      event: 'crew_pot_update';
      record: { id: string; skip_pot_cents: number };
      old_record: { skip_pot_cents: number };
    }
  | { event: 'scheduled'; job: 'daily_goal' | 'flame_extinguisher' | 'morning_ledger' };

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key, { auth: { persistSession: false } });
}

function tokensFrom(rows: { expo_push_token: string | null; push_notifications_enabled: boolean }[]): string[] {
  return rows
    .filter((r) => r.push_notifications_enabled && r.expo_push_token)
    .map((r) => r.expo_push_token as string);
}

async function sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  const batchSize = 100;
  for (let i = 0; i < tokens.length; i += batchSize) {
    await sendExpoPush(tokens.slice(i, i + batchSize), payload);
  }
}

async function fetchCrewMembers(client: ReturnType<typeof adminClient>, crewId: string): Promise<CrewMemberRow[]> {
  const today = viennaIsoDay();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartDay = viennaIsoDay(weekStart);

  const { data: members, error } = await client
    .from('crew_members')
    .select(`
      user_id,
      profiles!inner (
        name,
        daily_goal,
        streak_days,
        expo_push_token,
        push_notifications_enabled
      )
    `)
    .eq('crew_id', crewId);

  if (error) throw error;
  if (!members?.length) return [];

  const rows: CrewMemberRow[] = [];
  for (const member of members) {
    const profile = member.profiles as unknown as DbProfile;
    const userId = member.user_id as string;

    const { data: logs } = await client
      .from('pushup_logs')
      .select('count, logged_at')
      .eq('crew_id', crewId)
      .eq('user_id', userId);

    let todayCount = 0;
    let weekCount = 0;
    for (const log of logs ?? []) {
      const logDay = new Date(log.logged_at).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
      const count = Number(log.count) || 0;
      if (logDay === today) todayCount += count;
      if (logDay >= weekStartDay) weekCount += count;
    }

    rows.push({
      user_id: userId,
      name: profile.name,
      daily_goal: profile.daily_goal ?? 100,
      streak_days: profile.streak_days ?? 0,
      today: todayCount,
      week: weekCount,
      expo_push_token: profile.expo_push_token,
      push_notifications_enabled: profile.push_notifications_enabled,
    });
  }

  return rows;
}

async function handleChatMessage(body: Extract<DispatchBody, { event: 'chat_message' }>) {
  const client = adminClient();
  const { crew_id, user_id, text } = body.record;

  const { data: sender } = await client
    .from('profiles')
    .select('name')
    .eq('id', user_id)
    .maybeSingle();

  const members = await fetchCrewMembers(client, crew_id);
  const tokens = tokensFrom(members.filter((m) => m.user_id !== user_id));
  if (tokens.length === 0) return;

  const payload = chatMessagePayload(sender?.name ?? 'Crew', text);
  await sendToTokens(tokens, payload);
}

async function handlePushupLog(body: Extract<DispatchBody, { event: 'pushup_log' }>) {
  const client = adminClient();
  const { crew_id, user_id: triggerUserId, count: logCount } = body.record;

  const members = await fetchCrewMembers(client, crew_id);
  const trigger = members.find((m) => m.user_id === triggerUserId);
  if (!trigger) return;

  const triggerPrevWeek = trigger.week - logCount;
  const remainingSlackers = members.filter((m) => m.today < m.daily_goal);

  for (const target of members) {
    if (target.user_id === triggerUserId) continue;
    if (target.today >= target.daily_goal) continue;
    if (!target.push_notifications_enabled || !target.expo_push_token) continue;

    let payload: PushPayload;

    if (triggerPrevWeek <= target.week && trigger.week > target.week) {
      payload = leaderboardThreatPayload(trigger.name, logCount);
    } else if (
      isLoneWolfWindow() &&
      remainingSlackers.length === 1 &&
      remainingSlackers[0]?.user_id === target.user_id
    ) {
      payload = loneWolfPayload(trigger.name);
    } else {
      const { data: crew } = await client
        .from('crews')
        .select('skip_pot_cents')
        .eq('id', crew_id)
        .maybeSingle();
      payload = pickSlackerPayload(
        trigger.name,
        target.name,
        logCount,
        crew?.skip_pot_cents ?? 0,
      );
    }

    await sendToTokens([target.expo_push_token], payload);
  }
}

async function handlePotUpdate(body: Extract<DispatchBody, { event: 'crew_pot_update' }>) {
  const nextCents = body.record.skip_pot_cents;
  const prevCents = body.old_record.skip_pot_cents;
  if (nextCents <= 0 || nextCents % POT_MILESTONE_CENTS !== 0) return;
  if (nextCents <= prevCents) return;
  if (Math.floor(nextCents / POT_MILESTONE_CENTS) <= Math.floor(prevCents / POT_MILESTONE_CENTS)) {
    return;
  }

  const client = adminClient();
  const members = await fetchCrewMembers(client, body.record.id);
  const tokens = tokensFrom(members);
  if (tokens.length === 0) return;

  await sendToTokens(tokens, milestoneFeastPayload(nextCents));
}

async function handleDailyGoalReminder() {
  const client = adminClient();
  const gmt2Day = gmt2IsoDay();

  const { data: profiles, error } = await client
    .from('profiles')
    .select('id, daily_goal, expo_push_token, push_notifications_enabled')
    .not('expo_push_token', 'is', null)
    .eq('push_notifications_enabled', true);

  if (error) throw error;

  for (const profile of profiles ?? []) {
    const { data: membership } = await client
      .from('crew_members')
      .select('crew_id')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (!membership?.crew_id) continue;

    const { data: logs } = await client
      .from('pushup_logs')
      .select('count, logged_at')
      .eq('user_id', profile.id)
      .eq('crew_id', membership.crew_id);

    let todayCount = 0;
    for (const log of logs ?? []) {
      const logDay = new Date(new Date(log.logged_at).getTime() + 2 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      if (logDay === gmt2Day) todayCount += Number(log.count) || 0;
    }

    const goal = profile.daily_goal ?? 100;
    if (todayCount >= goal || !profile.expo_push_token) continue;

    await sendToTokens(
      [profile.expo_push_token],
      dailyGoalReminderPayload(goal - todayCount),
    );
  }
}

async function handleFlameExtinguisher() {
  const { hour } = viennaParts();
  if (hour !== 19) return;

  const client = adminClient();
  const membersByCrew = new Map<string, CrewMemberRow[]>();

  const { data: memberships } = await client
    .from('crew_members')
    .select('crew_id, user_id');

  const crewIds = [...new Set((memberships ?? []).map((m) => m.crew_id as string))];
  for (const crewId of crewIds) {
    membersByCrew.set(crewId, await fetchCrewMembers(client, crewId));
  }

  for (const members of membersByCrew.values()) {
    for (const member of members) {
      if (member.streak_days < 3) continue;
      if (member.today >= member.daily_goal) continue;
      if (!member.expo_push_token || !member.push_notifications_enabled) continue;

      await sendToTokens(
        [member.expo_push_token],
        flameExtinguisherPayload(member.streak_days),
      );
    }
  }
}

async function handleMorningLedger() {
  const { hour, minute } = viennaParts();
  if (hour !== 7 || minute !== 30) return;

  const client = adminClient();
  const yesterday = viennaYesterdayIso();

  const { data: crews } = await client.from('crews').select('id, skip_pot_cents');
  for (const crew of crews ?? []) {
    const members = await fetchCrewMembers(client, crew.id);
    let missedName: string | null = null;

    for (const member of members) {
      const met = await memberMetDay(client, crew.id, member.user_id, yesterday, member.daily_goal);
      if (!met) {
        missedName = member.name;
        break;
      }
    }

    if (!missedName) continue;

    const tokens = tokensFrom(members);
    if (tokens.length === 0) continue;

    await sendToTokens(tokens, morningLedgerPayload(missedName, crew.skip_pot_cents ?? 0));
  }
}

async function memberMetDay(
  client: ReturnType<typeof adminClient>,
  crewId: string,
  userId: string,
  day: string,
  goal: number,
): Promise<boolean> {
  const { data: logs } = await client
    .from('pushup_logs')
    .select('count, logged_at')
    .eq('crew_id', crewId)
    .eq('user_id', userId);

  let count = 0;
  for (const log of logs ?? []) {
    const logDay = new Date(log.logged_at).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
    if (logDay === day) count += Number(log.count) || 0;
  }
  return count >= goal;
}

async function dispatch(body: DispatchBody): Promise<Response> {
  switch (body.event) {
    case 'chat_message':
      await handleChatMessage(body);
      break;
    case 'pushup_log':
      await handlePushupLog(body);
      break;
    case 'crew_pot_update':
      await handlePotUpdate(body);
      break;
    case 'scheduled':
      if (body.job === 'daily_goal') await handleDailyGoalReminder();
      if (body.job === 'flame_extinguisher') await handleFlameExtinguisher();
      if (body.job === 'morning_ledger') await handleMorningLedger();
      break;
    default:
      return new Response(JSON.stringify({ error: 'Unknown event' }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  const headerSecret = req.headers.get('x-push-secret');
  if (!secret || headerSecret !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = (await req.json()) as DispatchBody;
    return await dispatch(body);
  } catch (err) {
    console.error('[push-dispatch]', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
