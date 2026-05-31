import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { CrewMember } from '@/types';
import { todayISO } from '@/lib/mechanics';

export const DAILY_REMINDER_ID = 'daily-goal-reminder';
const ANDROID_CHANNEL_ID = 'daily-reminders';
const GMT2_OFFSET_MS = 2 * 60 * 60 * 1000;
/** 18:00 in fixed GMT+2 = 16:00 UTC */
const DAILY_REMINDER_HOUR_GMT2 = 18;
const DAILY_REMINDER_UTC_HOUR = 16;
const DAILY_REMINDER_UTC_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelDailyGoalReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
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
  if (Platform.OS === 'web') return;

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
  if (Platform.OS === 'web') return;

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
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
