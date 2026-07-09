import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendExpoPush, type PushPayload } from '../_shared/expoPush.ts';
import {
  chatMessagePayload,
  dailyGoalReminderPayload,
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

type ProfileFields = {
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
  | { event: 'scheduled'; job: 'daily_goal' | 'flame_extinguisher' | 'morning_ledger' }
  | { event: 'test'; user_id: string };

type DispatchStats = {
  event: string;
  recipientCount: number;
  sent: number;
  skippedReason?: string;
  expoErrors: string[];
};

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

async function sendPayload(tokens: string[], payload: PushPayload): Promise<DispatchStats> {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) {
    return {
      event: payload.type,
      recipientCount: 0,
      sent: 0,
      skippedReason: 'no_push_tokens',
      expoErrors: [],
    };
  }

  const result = await sendExpoPush(unique, payload);
  console.log(
    `[push-dispatch] ${payload.type}: recipients=${unique.length} sent=${result.sent} errors=${result.errors.length}`,
  );

  return {
    event: payload.type,
    recipientCount: unique.length,
    sent: result.sent,
    expoErrors: result.errors,
  };
}

async function fetchCrewMembers(client: ReturnType<typeof adminClient>, crewId: string): Promise<CrewMemberRow[]> {
  const today = viennaIsoDay();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartDay = viennaIsoDay(weekStart);

  const { data: members, error: membersError } = await client
    .from('crew_members')
    .select('user_id')
    .eq('crew_id', crewId);

  if (membersError) throw membersError;
  if (!members?.length) return [];

  const rows: CrewMemberRow[] = [];

  for (const member of members) {
    const userId = member.user_id as string;

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('name, daily_goal, streak_days, expo_push_token, push_notifications_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) continue;

    const p = profile as ProfileFields;

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
      name: p.name,
      daily_goal: p.daily_goal ?? 100,
      streak_days: p.streak_days ?? 0,
      today: todayCount,
      week: weekCount,
      expo_push_token: p.expo_push_token,
      push_notifications_enabled: p.push_notifications_enabled ?? true,
    });
  }

  return rows;
}

async function handleChatMessage(body: Extract<DispatchBody, { event: 'chat_message' }>): Promise<DispatchStats> {
  const client = adminClient();
  const { crew_id, user_id, text } = body.record;

  const { data: sender } = await client
    .from('profiles')
    .select('name')
    .eq('id', user_id)
    .maybeSingle();

  const members = await fetchCrewMembers(client, crew_id);
  const tokens = tokensFrom(members.filter((m) => m.user_id !== user_id));

  console.log(
    `[push-dispatch] chat_message crew=${crew_id} members=${members.length} tokens=${tokens.length}`,
  );

  if (tokens.length === 0) {
    return {
      event: 'chat_message',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'no_recipient_tokens',
      expoErrors: [],
    };
  }

  return sendPayload(tokens, chatMessagePayload(sender?.name ?? 'Crew', text));
}

async function handlePushupLog(body: Extract<DispatchBody, { event: 'pushup_log' }>): Promise<DispatchStats> {
  const client = adminClient();
  const { crew_id, user_id: triggerUserId, count: logCount } = body.record;

  const members = await fetchCrewMembers(client, crew_id);
  const trigger = members.find((m) => m.user_id === triggerUserId);
  if (!trigger) {
    return {
      event: 'pushup_log',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'trigger_not_in_crew',
      expoErrors: [],
    };
  }

  const triggerPrevWeek = trigger.week - logCount;
  const remainingSlackers = members.filter((m) => m.today < m.daily_goal);
  const stats: DispatchStats = {
    event: 'pushup_log',
    recipientCount: 0,
    sent: 0,
    expoErrors: [],
  };

  for (const target of members) {
    if (target.user_id === triggerUserId) continue;
    if (target.today >= target.daily_goal) continue;
    if (!target.push_notifications_enabled || !target.expo_push_token) continue;

    stats.recipientCount += 1;

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
      payload = pickSlackerPayload(trigger.name, target.name, logCount, crew?.skip_pot_cents ?? 0);
    }

    const result = await sendPayload([target.expo_push_token], payload);
    stats.sent += result.sent;
    stats.expoErrors.push(...result.expoErrors);
  }

  if (stats.recipientCount === 0) {
    stats.skippedReason = 'all_targets_met_goal_or_no_tokens';
  }

  return stats;
}

async function handlePotUpdate(body: Extract<DispatchBody, { event: 'crew_pot_update' }>): Promise<DispatchStats> {
  const nextCents = body.record.skip_pot_cents;
  const prevCents = body.old_record.skip_pot_cents;
  if (nextCents <= 0 || nextCents % POT_MILESTONE_CENTS !== 0) {
    return {
      event: 'crew_pot_update',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'not_a_milestone',
      expoErrors: [],
    };
  }
  if (nextCents <= prevCents) {
    return {
      event: 'crew_pot_update',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'pot_did_not_increase',
      expoErrors: [],
    };
  }
  if (Math.floor(nextCents / POT_MILESTONE_CENTS) <= Math.floor(prevCents / POT_MILESTONE_CENTS)) {
    return {
      event: 'crew_pot_update',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'milestone_already_sent',
      expoErrors: [],
    };
  }

  const client = adminClient();
  const members = await fetchCrewMembers(client, body.record.id);
  const tokens = tokensFrom(members);
  if (tokens.length === 0) {
    return {
      event: 'milestone_feast',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'no_recipient_tokens',
      expoErrors: [],
    };
  }

  return sendPayload(tokens, milestoneFeastPayload(nextCents));
}

async function handleDailyGoalReminder(): Promise<DispatchStats> {
  const client = adminClient();
  const gmt2Day = gmt2IsoDay();
  const stats: DispatchStats = {
    event: 'daily_goal_reminder',
    recipientCount: 0,
    sent: 0,
    expoErrors: [],
  };

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

    stats.recipientCount += 1;
    const result = await sendPayload(
      [profile.expo_push_token],
      dailyGoalReminderPayload(goal - todayCount),
    );
    stats.sent += result.sent;
    stats.expoErrors.push(...result.expoErrors);
  }

  return stats;
}

async function handleFlameExtinguisher(): Promise<DispatchStats> {
  const { hour } = viennaParts();
  if (hour !== 19) {
    return {
      event: 'flame_extinguisher',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'outside_vienna_19_00_window',
      expoErrors: [],
    };
  }

  const client = adminClient();
  const stats: DispatchStats = {
    event: 'flame_extinguisher',
    recipientCount: 0,
    sent: 0,
    expoErrors: [],
  };

  const { data: memberships } = await client.from('crew_members').select('crew_id, user_id');
  const crewIds = [...new Set((memberships ?? []).map((m) => m.crew_id as string))];

  for (const crewId of crewIds) {
    const members = await fetchCrewMembers(client, crewId);
    for (const member of members) {
      if (member.streak_days < 3) continue;
      if (member.today >= member.daily_goal) continue;
      if (!member.expo_push_token || !member.push_notifications_enabled) continue;

      stats.recipientCount += 1;
      const result = await sendPayload(
        [member.expo_push_token],
        flameExtinguisherPayload(member.streak_days),
      );
      stats.sent += result.sent;
      stats.expoErrors.push(...result.expoErrors);
    }
  }

  return stats;
}

async function handleMorningLedger(): Promise<DispatchStats> {
  const { hour, minute } = viennaParts();
  if (hour !== 7 || minute !== 30) {
    return {
      event: 'morning_ledger',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'outside_vienna_07_30_window',
      expoErrors: [],
    };
  }

  const client = adminClient();
  const yesterday = viennaYesterdayIso();
  const stats: DispatchStats = {
    event: 'morning_ledger',
    recipientCount: 0,
    sent: 0,
    expoErrors: [],
  };

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

    stats.recipientCount += tokens.length;
    const result = await sendPayload(tokens, morningLedgerPayload(missedName, crew.skip_pot_cents ?? 0));
    stats.sent += result.sent;
    stats.expoErrors.push(...result.expoErrors);
  }

  return stats;
}

async function handleTestPush(body: Extract<DispatchBody, { event: 'test' }>): Promise<DispatchStats> {
  const client = adminClient();
  const { data: profile, error } = await client
    .from('profiles')
    .select('expo_push_token, push_notifications_enabled')
    .eq('id', body.user_id)
    .maybeSingle();

  if (error) throw error;
  if (!profile?.expo_push_token) {
    return {
      event: 'test',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'user_has_no_push_token',
      expoErrors: [],
    };
  }
  if (!profile.push_notifications_enabled) {
    return {
      event: 'test',
      recipientCount: 0,
      sent: 0,
      skippedReason: 'push_notifications_disabled',
      expoErrors: [],
    };
  }

  return sendPayload([profile.expo_push_token], {
    type: 'chat_message',
    title: 'PushupCrew test',
    body: 'If you see this, remote push is working.',
    channelId: 'crew-alerts',
  });
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
  let stats: DispatchStats;

  switch (body.event) {
    case 'chat_message':
      stats = await handleChatMessage(body);
      break;
    case 'pushup_log':
      stats = await handlePushupLog(body);
      break;
    case 'crew_pot_update':
      stats = await handlePotUpdate(body);
      break;
    case 'scheduled':
      if (body.job === 'daily_goal') stats = await handleDailyGoalReminder();
      else if (body.job === 'flame_extinguisher') stats = await handleFlameExtinguisher();
      else if (body.job === 'morning_ledger') stats = await handleMorningLedger();
      else {
        return new Response(JSON.stringify({ error: 'Unknown scheduled job' }), { status: 400 });
      }
      break;
    case 'test':
      stats = await handleTestPush(body);
      break;
    default:
      return new Response(JSON.stringify({ error: 'Unknown event' }), { status: 400 });
  }

  const ok = stats.sent > 0 || Boolean(stats.skippedReason);
  return new Response(JSON.stringify({ ok, ...stats }), {
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
    console.log('[push-dispatch] received', body.event);
    return await dispatch(body);
  } catch (err) {
    console.error('[push-dispatch]', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
