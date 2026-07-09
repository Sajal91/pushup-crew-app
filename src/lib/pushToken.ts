import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { clearMyPushToken, updateMyPushToken } from '@/lib/crewDb';
import { ensureNotificationPermissions } from '@/lib/notifications';
import { supabaseConfigured } from '@/lib/supabase';

let lastSyncedToken: string | null = null;
let tokenListenerAttached = false;

function shouldSkipPushToken(): boolean {
  return (
    Platform.OS === 'web' ||
    (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
  );
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function logPush(message: string, err?: unknown): void {
  if (err !== undefined) {
    console.warn(`[push] ${message}`, err);
    return;
  }
  console.log(`[push] ${message}`);
}

/** Register the device Expo push token and persist it on the user's profile. */
export async function syncPushToken(force = false): Promise<boolean> {
  if (!supabaseConfigured || shouldSkipPushToken()) return false;

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    logPush('Permission not granted — enable notifications in system settings');
    return false;
  }

  const Notifications = await import('expo-notifications');
  const easProjectId = projectId();
  if (!easProjectId) {
    logPush('Missing EAS projectId in app config — cannot register push token');
    return false;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
    if (!token) {
      logPush('Expo returned an empty push token');
      return false;
    }
    if (!force && token === lastSyncedToken) return true;

    await updateMyPushToken(token);
    lastSyncedToken = token;
    logPush(`Registered token ${token.slice(0, 28)}…`);
    return true;
  } catch (err) {
    logPush('Failed to register push token', err);
    return false;
  }
}

/** Re-sync when Expo rotates the device token. */
export function attachPushTokenListener(): () => void {
  if (!supabaseConfigured || shouldSkipPushToken() || tokenListenerAttached) {
    return () => {};
  }

  tokenListenerAttached = true;
  let subscription: { remove: () => void } | null = null;

  void import('expo-notifications').then((Notifications) => {
    subscription = Notifications.addPushTokenListener(() => {
      lastSyncedToken = null;
      void syncPushToken(true);
    });
  });

  return () => {
    tokenListenerAttached = false;
    subscription?.remove();
  };
}

/** Re-register token when the app returns to foreground. */
export function attachPushTokenAppStateListener(): () => void {
  if (!supabaseConfigured || shouldSkipPushToken()) {
    return () => {};
  }

  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void syncPushToken(true);
    }
  });

  return () => sub.remove();
}

export async function clearPushTokenOnSignOut(): Promise<void> {
  lastSyncedToken = null;
  if (!supabaseConfigured) return;
  try {
    await clearMyPushToken();
  } catch (err) {
    logPush('Failed to clear push token', err);
  }
}
