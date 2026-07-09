import { Platform } from 'react-native';
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

/** Register the device Expo push token and persist it on the user's profile. */
export async function syncPushToken(): Promise<void> {
  if (!supabaseConfigured || shouldSkipPushToken()) return;

  const granted = await ensureNotificationPermissions();
  if (!granted) return;

  const Notifications = await import('expo-notifications');
  const easProjectId = projectId();
  if (!easProjectId) {
    if (__DEV__) console.warn('[push] Missing EAS projectId — cannot register push token');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
    if (!token || token === lastSyncedToken) return;

    await updateMyPushToken(token);
    lastSyncedToken = token;

    if (__DEV__) console.log('[push] Registered Expo push token');
  } catch (err) {
    if (__DEV__) console.warn('[push] Failed to register push token:', err);
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
      void syncPushToken();
    });
  });

  return () => {
    tokenListenerAttached = false;
    subscription?.remove();
  };
}

export async function clearPushTokenOnSignOut(): Promise<void> {
  lastSyncedToken = null;
  if (!supabaseConfigured) return;
  try {
    await clearMyPushToken();
  } catch (err) {
    if (__DEV__) console.warn('[push] Failed to clear push token:', err);
  }
}
