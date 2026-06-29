import type { ChatMessage, Crew, CrewMember, DailyStat, PushupLog, RegionalCrewRank } from '@/types';
import { mapAccountStatus, type AccountStatus } from '@/lib/accountStatus';
import { resolveCurrentCrewRegion } from '@/lib/regions';
import { XP_PER_PUSHUP, levelFromXp, nowHHMM } from '@/lib/mechanics';
import { supabase } from '@/lib/supabase';

export type { AccountStatus };

export type CrewPreview = {
  crewId: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  memberNames: string[];
};

export type CrewSnapshot = {
  crew: Crew;
  dailyGoal: number;
  members: CrewMember[];
  chat: ChatMessage[];
};

export type PersonalStats = {
  lifetimeTotal: number;
  streak: number;
  dailyGoal?: number;
};

type DbPersonalStats = {
  lifetime_total: number;
  streak: number;
  daily_goal?: number;
};

type DbCrewPreview = {
  crew_id: string;
  name: string;
  invite_code: string;
  member_count: number;
  members: { name: string }[];
};

type DbRegionalCrewRank = {
  id: string;
  name: string;
  member_count: number;
  today: number;
  week: number;
  is_mine?: boolean;
};

type DbSnapshot = {
  crew: {
    id: string;
    name: string;
    invite_code: string;
    skip_pot_cents: number;
    owner_id?: string | null;
    region?: string | null;
  };
  daily_goal: number;
  members: {
    id: string;
    image?: string;
    name: string;
    handle: string;
    daily_goal?: number;
    daily_stats?: { day: string; count: number }[];
    lifetime_total?: number;
    streak?: number;
    skip_days?: number;
    today: number;
    week: number;
    total?: number;
  }[];
  chat: {
    id: number;
    user_id: string;
    text: string;
    created_at: string;
  }[];
};

export type DbChatMessage = {
  id: number;
  user_id: string;
  text: string;
  created_at: string;
};

type DbPushupLog = {
  id: number;
  user_id: string;
  crew_id: string | null;
  count: number;
  logged_at: string;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const RPC_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function mapRpcError(error: { message: string; code?: string }): string {
  const msg = error.message ?? '';
  if (msg.includes('crew_not_found')) return 'No crew found with that code.';
  if (msg.includes('invite_code_taken')) return 'That invite code is already taken.';
  if (msg.includes('already_in_crew')) return 'You are already in a crew.';
  if (msg.includes('not_in_crew')) return 'You are not in a crew.';
  if (msg.includes('same_crew')) return 'You are already in that crew.';
  if (msg.includes('profile_not_found')) return 'Complete your profile first.';
  if (msg.includes('auth_user_not_ready')) return 'Still signing you in — try again in a moment.';
  if (msg.includes('profiles_id_fkey')) return 'Account not ready yet — wait a moment and try again.';
  if (msg.includes('invalid_invite_code')) return 'Invite code must be at least 4 characters.';
  if (msg.includes('not_crew_owner')) return 'Only the crew owner can change the crew name.';
  if (msg.includes('invalid_crew_name')) return 'Crew name cannot be empty.';
  return msg || 'Something went wrong.';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapPreview(row: DbCrewPreview): CrewPreview {
  return {
    crewId: row.crew_id,
    name: row.name,
    inviteCode: row.invite_code,
    memberCount: row.member_count,
    memberNames: (row.members ?? []).map((m) => m.name),
  };
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function mapDbChatMessage(row: DbChatMessage): ChatMessage {
  return {
    id: row.id,
    who: row.user_id,
    t: formatChatTime(row.created_at),
    text: row.text,
  };
}

function mapDbPushupLog(row: DbPushupLog): PushupLog {
  return {
    id: row.id,
    userId: row.user_id,
    crewId: row.crew_id,
    count: Number(row.count) || 0,
    loggedAt: row.logged_at,
  };
}

function mapDailyStats(rows: { day: string; count: number }[] | undefined): DailyStat[] {
  return (rows ?? []).map((row) => ({
    day: row.day,
    count: Number(row.count) || 0,
  }));
}

function mapPersonalStats(row: DbPersonalStats): PersonalStats {
  return {
    lifetimeTotal: Number(row.lifetime_total) || 0,
    streak: Number(row.streak) || 0,
    dailyGoal: row.daily_goal,
  };
}

export function memberFromPersonalStats(
  lifetimeTotal: number,
  streak: number,
): Pick<CrewMember, 'total' | 'xp' | 'level' | 'streak'> {
  const xp = lifetimeTotal * XP_PER_PUSHUP;
  return {
    total: lifetimeTotal,
    xp,
    level: levelFromXp(xp),
    streak,
  };
}

export function mapSnapshotToState(snapshot: DbSnapshot, meId: string): CrewSnapshot {
  const crew: Crew = {
    id: snapshot.crew.id,
    name: snapshot.crew.name,
    inviteCode: snapshot.crew.invite_code,
    skipPotCents: snapshot.crew.skip_pot_cents,
    ownerId: snapshot.crew.owner_id ?? undefined,
    region: snapshot.crew.region ?? undefined,
  };

  const members: CrewMember[] = (snapshot.members ?? []).map((m) => {
    const lifetimeTotal = m.lifetime_total ?? m.total ?? 0;
    const personal = memberFromPersonalStats(lifetimeTotal, m.streak ?? 0);
    return {
      id: m.id,
      name: m.name,
      image: m.image ?? '',
      handle: m.handle,
      dailyGoal: m.daily_goal ?? 100,
      dailyStats: mapDailyStats(m.daily_stats),
      today: m.today,
      week: m.week,
      skipDays: m.skip_days ?? 0,
      ...personal,
      isMe: m.id === meId,
    };
  });

  const chat: ChatMessage[] = (snapshot.chat ?? []).map(mapDbChatMessage);

  return {
    crew,
    dailyGoal: snapshot.daily_goal ?? 100,
    members,
    chat,
  };
}

async function upsertMyProfileOnce(name: string, dailyGoal: number): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('upsert_my_profile', {
    p_name: name,
    p_daily_goal: dailyGoal,
  });
  if (error) throw new Error(mapRpcError(error));
}

/** Upsert profile after Supabase Auth user exists (retries on race / stale JWT). */
export async function upsertMyProfile(name: string, dailyGoal = 100): Promise<void> {
  const client = requireClient();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    throw new Error('Not signed in');
  }

  const delays = [0, 400, 900];
  let lastError: Error | null = null;

  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    try {
      await upsertMyProfileOnce(name, dailyGoal);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retryable =
        lastError.message.includes('profiles_id_fkey') ||
        lastError.message.includes('auth_user_not_ready') ||
        lastError.message.includes('Account not ready');
      if (!retryable) throw lastError;
    }
  }

  throw lastError ?? new Error('Could not save profile');
}

export async function fetchMyAccountStatus(): Promise<AccountStatus> {
  const client = requireClient();
  const { data, error } = await withTimeout(
    client.rpc('get_my_account_status'),
    RPC_TIMEOUT_MS,
    'Account status',
  );
  if (error) throw new Error(mapRpcError(error));
  return mapAccountStatus(
    data as {
      email: string | null;
      is_returning_user: boolean;
      is_new_user: boolean;
      name_setup_complete: boolean;
      has_crew: boolean;
      name: string;
      daily_goal: number;
    },
  );
}

export async function confirmMyProfileName(name: string, dailyGoal = 100): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc('confirm_my_profile_name', {
    p_name: name,
    p_daily_goal: dailyGoal,
  });
  if (error) throw new Error(mapRpcError(error));
}

export async function updateMyDailyGoal(dailyGoal: number): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc('update_my_daily_goal', {
    p_daily_goal: dailyGoal,
  });
  if (error) throw new Error(mapRpcError(error));
  const row = data as { daily_goal?: number | null } | null;
  if (row?.daily_goal != null) {
    return Number(row.daily_goal);
  }
  return dailyGoal;
}

export async function updateMyCrewName(crewName: string): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.rpc('update_my_crew_name', {
    p_crew_name: crewName,
  });
  if (error) throw new Error(mapRpcError(error));
  const row = data as { name?: string | null } | null;
  if (row?.name) {
    return row.name;
  }
  return crewName.trim();
}

export async function previewCrewByInviteCode(code: string): Promise<CrewPreview | null> {
  const client = requireClient();
  const { data, error } = await client.rpc('preview_crew_by_invite_code', {
    p_invite_code: code,
  });
  if (error) throw new Error(mapRpcError(error));
  if (!data) return null;
  return mapPreview(data as DbCrewPreview);
}

export async function createMyCrew(crewName: string, inviteCode: string): Promise<CrewSnapshot> {
  const region = await resolveCurrentCrewRegion();
  const client = requireClient();
  const { data, error } = await client.rpc('create_my_crew', {
    p_crew_name: crewName,
    p_invite_code: inviteCode,
    p_region: region,
  });
  if (error) throw new Error(mapRpcError(error));
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return mapSnapshotToState(data as DbSnapshot, user.id);
}

export async function joinCrewByInviteCode(code: string): Promise<CrewSnapshot> {
  const client = requireClient();
  const { data, error } = await client.rpc('join_crew_by_invite_code', {
    p_invite_code: code,
  });
  if (error) throw new Error(mapRpcError(error));
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return mapSnapshotToState(data as DbSnapshot, user.id);
}

export async function leaveMyCrew(): Promise<PersonalStats> {
  const client = requireClient();
  const { data, error } = await client.rpc('leave_my_crew');
  if (error) throw new Error(mapRpcError(error));
  return mapPersonalStats(data as DbPersonalStats);
}

export async function fetchMyPersonalStats(): Promise<PersonalStats | null> {
  const client = requireClient();
  const { data, error } = await withTimeout(
    client.rpc('get_my_personal_stats'),
    RPC_TIMEOUT_MS,
    'Personal stats',
  );
  if (error) throw new Error(mapRpcError(error));
  if (!data) return null;
  return mapPersonalStats(data as DbPersonalStats);
}

export async function fetchMyCrewSnapshot(userId?: string): Promise<CrewSnapshot | null> {
  const client = requireClient();
  const { data, error } = await withTimeout(
    client.rpc('get_my_crew_snapshot'),
    RPC_TIMEOUT_MS,
    'Crew sync',
  );
  if (error) throw new Error(mapRpcError(error));
  if (!data) return null;

  let meId = userId;
  if (!meId) {
    const { data: sessionData } = await client.auth.getSession();
    meId = sessionData.session?.user.id;
  }
  if (!meId) return null;

  return mapSnapshotToState(data as DbSnapshot, meId);
}

function mapRegionalCrewRank(row: DbRegionalCrewRank): RegionalCrewRank {
  return {
    id: row.id,
    name: row.name,
    memberCount: Number(row.member_count) || 0,
    today: Number(row.today) || 0,
    week: Number(row.week) || 0,
    isMine: Boolean(row.is_mine),
  };
}

export async function fetchRegionalCrewRankings(): Promise<RegionalCrewRank[]> {
  const client = requireClient();
  const { data, error } = await withTimeout(
    client.rpc('get_regional_crew_rankings'),
    RPC_TIMEOUT_MS,
    'Regional rankings',
  );
  if (error) throw new Error(mapRpcError(error));
  return ((data ?? []) as DbRegionalCrewRank[]).map(mapRegionalCrewRank);
}

export async function fetchCrewPushupLogs(crewId: string): Promise<PushupLog[]> {
  const client = requireClient();
  const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from('pushup_logs')
    .select('id, user_id, crew_id, count, logged_at')
    .eq('crew_id', crewId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as DbPushupLog[]).map(mapDbPushupLog);
}

export async function insertPushupLog(crewId: string, count: number): Promise<void> {
  const client = requireClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await client.from('pushup_logs').insert({
    user_id: user.id,
    crew_id: crewId,
    count,
  });
  if (error) throw new Error(error.message);
}

export async function insertChatMessage(crewId: string, text: string): Promise<ChatMessage> {
  const client = requireClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { data, error } = await client
    .from('chat_messages')
    .insert({
      crew_id: crewId,
      user_id: user.id,
      text,
    })
    .select('id, user_id, text, created_at')
    .single();

  if (error) throw new Error(error.message);

  return {
    ...mapDbChatMessage(data),
  };
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `GAINS-${s}`;
}
