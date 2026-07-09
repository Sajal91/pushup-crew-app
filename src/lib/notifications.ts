import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { CrewMember } from '@/types';
import { todayISO } from '@/lib/mechanics';
import { nextViennaWallClock } from '@/lib/viennaTime';

export const DAILY_REMINDER_ID = 'daily-goal-reminder';
export const FLAME_EXTINGUISHER_ID = 'crew-flame-extinguisher';
export const MORNING_LEDGER_ID = 'crew-morning-ledger';
const ANDROID_CHANNEL_ID = 'daily-reminders';
const CREW_CHANNEL_ID = 'crew-alerts';
const FLAME_EXTINGUISHER_HOUR = 19;
const FLAME_EXTINGUISHER_MINUTE = 0;
const MORNING_LEDGER_HOUR = 7;
const MORNING_LEDGER_MINUTE = 30;

export type CrewNotificationType =
  | 'domino_effect'
  | 'leaderboard_threat'
  | 'lone_wolf'
  | 'flame_extinguisher'
  | 'free_pass'
  | 'morning_ledger'
  | 'milestone_feast'
  | 'chat_message';

export type CrewNotificationPayload = {
  type: CrewNotificationType;
  title: string;
  body: string;
};
const GMT2_OFFSET_MS = 2 * 60 * 60 * 1000;
/** 18:00 in fixed GMT+2 = 16:00 UTC */
const DAILY_REMINDER_HOUR_GMT2 = 18;
const DAILY_REMINDER_UTC_HOUR = 16;
const DAILY_REMINDER_UTC_MINUTE = 0;

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;
type NotificationSubscription = { remove: () => void };

let notificationsModule: NotificationsModule | null = null;
let notificationsHandlerConfigured = false;
let expoGoSkipLogged = false;

function shouldSkipNotifications(): boolean {
  return (
    Platform.OS === 'web' ||
    (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
  );
}

function logExpoGoSkipOnce(): void {
  if (!__DEV__ || expoGoSkipLogged) return;
  expoGoSkipLogged = true;
  console.log('[notifications] Skipped in Android Expo Go. Use a development build to test notifications.');
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (shouldSkipNotifications()) {
    logExpoGoSkipOnce();
    return null;
  }

  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }

  if (!notificationsHandlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationsHandlerConfigured = true;
  }

  return notificationsModule;
}

/** Calendar day YYYY-MM-DD in fixed GMT+2 (matches the 18:00 reminder timezone). */
export function gmt2IsoDay(date = new Date()): string {
  const gmt2 = new Date(date.getTime() + GMT2_OFFSET_MS);
  return [
    gmt2.getUTCFullYear(),
    String(gmt2.getUTCMonth() + 1).padStart(2, '0'),
    String(gmt2.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Pushup count for the current GMT+2 calendar day. */
export function todayPushupsGmt2(me: CrewMember): number {
  const gmt2Day = gmt2IsoDay();
  const fromStats = me.dailyStats?.find((s) => s.day === gmt2Day)?.count;
  if (fromStats !== undefined) return fromStats;
  if (gmt2Day === todayISO()) return me.today;
  return 0;
}

/** Next 18:00 GMT+2 as a UTC instant (18:00 GMT+2 = 16:00 UTC). */
export function nextDailyReminderAtGmt2(now = new Date()): Date {
  const gmt2 = new Date(now.getTime() + GMT2_OFFSET_MS);
  const y = gmt2.getUTCFullYear();
  const mo = gmt2.getUTCMonth();
  const d = gmt2.getUTCDate();
  const hour = gmt2.getUTCHours();
  const minute = gmt2.getUTCMinutes();

  const pastReminderToday =
    hour > DAILY_REMINDER_HOUR_GMT2 ||
    (hour === DAILY_REMINDER_HOUR_GMT2 && minute >= 0);

  if (pastReminderToday) {
    return new Date(Date.UTC(y, mo, d + 1, DAILY_REMINDER_UTC_HOUR, DAILY_REMINDER_UTC_MINUTE, 0, 0));
  }

  return new Date(Date.UTC(y, mo, d, DAILY_REMINDER_UTC_HOUR, DAILY_REMINDER_UTC_MINUTE, 0, 0));
}

function formatGmt2Time(date: Date): string {
  const gmt2 = new Date(date.getTime() + GMT2_OFFSET_MS);
  const h = String(gmt2.getUTCHours()).padStart(2, '0');
  const m = String(gmt2.getUTCMinutes()).padStart(2, '0');
  return `${gmt2.getUTCFullYear()}-${String(gmt2.getUTCMonth() + 1).padStart(2, '0')}-${String(gmt2.getUTCDate()).padStart(2, '0')} ${h}:${m} GMT+2`;
}

function minutesUntil(date: Date): number {
  return Math.max(0, Math.round((date.getTime() - Date.now()) / 60_000));
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync(CREW_CHANNEL_ID, {
    name: 'Crew Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  await ensureAndroidChannels();

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelDailyGoalReminder(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
}

/**
 * Schedule a local notification for 18:00 GMT+2 if the daily goal is not met.
 * Reschedule after every sync or log so the remaining count stays accurate.
 */
export async function rescheduleDailyGoalReminder(params: {
  todayCount: number;
  dailyGoal: number;
}): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await cancelDailyGoalReminder();

  if (params.dailyGoal <= 0 || params.todayCount >= params.dailyGoal) {
    if (__DEV__) {
      console.log('[notifications] Daily reminder skipped — goal already met');
    }
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    if (__DEV__) {
      console.warn('[notifications] Permission not granted — enable notifications in system settings');
    }
    return;
  }

  const remaining = params.dailyGoal - params.todayCount;
  let triggerDate = nextDailyReminderAtGmt2();

  // Never schedule in the past (Android may drop or fire silently).
  if (triggerDate.getTime() <= Date.now() + 30_000) {
    triggerDate = new Date(
      Date.UTC(
        triggerDate.getUTCFullYear(),
        triggerDate.getUTCMonth(),
        triggerDate.getUTCDate() + 1,
        DAILY_REMINDER_UTC_HOUR,
        DAILY_REMINDER_UTC_MINUTE,
        0,
        0,
      ),
    );
  }

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'DAILY GOAL',
      body: `${remaining} pushups left today. Skip = €1 in the pot.`,
      data: { type: 'daily_goal_reminder', remaining },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: ANDROID_CHANNEL_ID,
    },
  });

  if (__DEV__) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.find((n) => n.identifier === DAILY_REMINDER_ID);
    console.log(
      `[notifications] Daily reminder scheduled for ${formatGmt2Time(triggerDate)} ` +
        `(${triggerDate.toISOString()}, in ~${minutesUntil(triggerDate)} min, ${remaining} left)` +
        (ours ? '' : ' — WARNING: not found in scheduled list'),
    );
  }
}

/** Fire a notification in a few seconds — use only to verify permissions on a device. */
export async function scheduleTestNotification(secondsFromNow = 10): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    console.warn('[notifications] Test skipped — permission not granted');
    return;
  }

  const triggerDate = new Date(Date.now() + secondsFromNow * 1000);

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-goal-reminder-test',
    content: {
      title: 'Daily Goal Reminder',
      body: 'This is a test notification for daily goal Reminder.',
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: ANDROID_CHANNEL_ID,
    },
  });

  console.log(`[notifications] Test notification in ${secondsFromNow}s (${triggerDate.toISOString()})`);
}

export async function syncDailyGoalReminder(me: CrewMember | undefined, dailyGoal: number): Promise<void> {
  if (!me) return;
  const goal = me.dailyGoal ?? dailyGoal;
  await rescheduleDailyGoalReminder({
    todayCount: todayPushupsGmt2(me),
    dailyGoal: goal,
  });
}

export async function clearDailyGoalReminderOnSignOut(): Promise<void> {
  await cancelDailyGoalReminder();
  await cancelCrewScheduledNotifications();
}

function crewChannelProps(): { channelId?: string } {
  return Platform.OS === 'android' ? { channelId: CREW_CHANNEL_ID } : {};
}

export async function presentCrewNotification(payload: CrewNotificationPayload): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const granted = await ensureNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.body,
      data: { type: payload.type },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      ...crewChannelProps(),
    },
    trigger: null,
  });

  if (__DEV__) {
    console.log(`[notifications] Crew alert: ${payload.type} — ${payload.title}`);
  }
}

async function scheduleCrewNotificationAtViennaTime(
  identifier: string,
  hour: number,
  minute: number,
  payload: CrewNotificationPayload,
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const granted = await ensureNotificationPermissions();
  if (!granted) return;

  const triggerDate = nextViennaWallClock(hour, minute);

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: payload.title,
      body: payload.body,
      data: { type: payload.type },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      ...crewChannelProps(),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: CREW_CHANNEL_ID,
    },
  });

  if (__DEV__) {
    console.log(
      `[notifications] Scheduled ${payload.type} for Vienna ${hour}:${String(minute).padStart(2, '0')} ` +
        `(${triggerDate.toISOString()}, in ~${minutesUntil(triggerDate)} min)`,
    );
  }
}

export async function rescheduleFlameExtinguisher(
  payload: CrewNotificationPayload | null,
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.cancelScheduledNotificationAsync(FLAME_EXTINGUISHER_ID);
  if (!payload) return;

  await scheduleCrewNotificationAtViennaTime(
    FLAME_EXTINGUISHER_ID,
    FLAME_EXTINGUISHER_HOUR,
    FLAME_EXTINGUISHER_MINUTE,
    payload,
  );
}

export async function rescheduleMorningLedger(payload: CrewNotificationPayload | null): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.cancelScheduledNotificationAsync(MORNING_LEDGER_ID);
  if (!payload) return;

  await scheduleCrewNotificationAtViennaTime(
    MORNING_LEDGER_ID,
    MORNING_LEDGER_HOUR,
    MORNING_LEDGER_MINUTE,
    payload,
  );
}

export async function cancelCrewScheduledNotifications(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.cancelScheduledNotificationAsync(FLAME_EXTINGUISHER_ID);
  await Notifications.cancelScheduledNotificationAsync(MORNING_LEDGER_ID);
}

export function resetCrewNotificationTracking(): void {
  // Reserved for module-level dedupe state if needed later.
}

export function addNotificationResponseListener(
  handler: (response: NotificationResponse) => void,
): NotificationSubscription {
  if (shouldSkipNotifications()) {
    logExpoGoSkipOnce();
    return { remove: () => {} };
  }

  let subscription: NotificationSubscription | null = null;
  let removed = false;
  void getNotifications().then((Notifications) => {
    if (!Notifications) return;
    const nextSubscription = Notifications.addNotificationResponseReceivedListener(handler);
    if (removed) {
      nextSubscription.remove();
      return;
    }
    subscription = nextSubscription;
  });

  return {
    remove: () => {
      removed = true;
      subscription?.remove();
    },
  };
}
